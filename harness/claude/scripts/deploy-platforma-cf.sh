#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Deploy Platforma AWS EKS CloudFormation stacks for the MILAB-6670 auth comparison.

  deploy-platforma-cf.sh <1|2|3|all> [--params FILE] [--repo DIR] [--dry-run]

  1   v4.3.5 released template, LDAP     AuthMethod=ldap
  2   branch template, LDAP              LdapServer set, AuthMethod empty
  3   branch template, no auth provider  all sources off; forced `platforma` admin

  --params FILE   default: <repo>/../.notes/cf-deploy.params
  --repo DIR      the pl checkout; default $PL_REPO, else cwd
  --dry-run       print each parameter set and the template it would publish

Each stack takes ~20 minutes. Watch one with:
  aws cloudformation describe-stack-events --stack-name NAME --max-items 20 \
    --query 'StackEvents[].[Timestamp,ResourceStatus,LogicalResourceId]' --output table

Stack 3's only login is user `platforma`; read its password with:
  aws ssm get-parameter --name /CLUSTER_NAME/platforma/admin-password --with-decryption
EOF
}

TAG_REF=v4.3.5
TEMPLATE_PATH=helm/infrastructure/aws/cloudformation/cloudformation-eks-1-35.yaml
DRY_RUN=0
REPO=${PL_REPO:-$PWD}
PARAMS=

WHICH=${1:-}
[[ -z $WHICH || $WHICH == -h || $WHICH == --help ]] && { usage; exit 0; }
shift

while [[ $# -gt 0 ]]; do
  case $1 in
    --params)  PARAMS=$2; shift 2 ;;
    --repo)    REPO=$2; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case $WHICH in 1|2|3|all) ;; *) echo "expected 1, 2, 3 or all — got: $WHICH" >&2; exit 2 ;; esac

[[ -f $REPO/$TEMPLATE_PATH ]] || { echo "not a pl checkout: $REPO (no $TEMPLATE_PATH)" >&2; exit 2; }
: "${PARAMS:=$REPO/../.notes/cf-deploy.params}"
[[ -f $PARAMS ]] || { echo "params file not found: $PARAMS" >&2; exit 2; }

# shellcheck disable=SC1090
source "$PARAMS"

export AWS_DEFAULT_REGION=$AWS_REGION
[[ -n ${AWS_PROFILE_NAME:-} ]] && export AWS_PROFILE=$AWS_PROFILE_NAME

unfilled=$(grep -oE '^[A-Z0-9_]+=FILL_ME' "$PARAMS" | cut -d= -f1 || true)
if [[ -n $unfilled ]]; then
  echo "params still unfilled in $PARAMS:" >&2
  echo "$unfilled" | sed 's/^/  /' >&2
  exit 2
fi

if [[ -n ${LDAP_BIND_DN:-} && -n ${LDAP_SEARCH_USER:-} ]]; then
  echo "LDAP_BIND_DN and LDAP_SEARCH_USER are both set — pick direct bind OR search bind." >&2
  exit 2
fi
if [[ $WHICH != 3 && -z ${LDAP_BIND_DN:-} && -z ${LDAP_SEARCH_RULES:-} ]]; then
  echo "stacks 1 and 2 need LDAP_BIND_DN (direct bind) or LDAP_SEARCH_RULES (search bind)." >&2
  exit 2
fi
if [[ -n ${LDAP_SEARCH_USER:-} && -z ${LDAP_SEARCH_PASSWORD:-} ]]; then
  echo "LDAP_SEARCH_USER is set but LDAP_SEARCH_PASSWORD is empty — search bind would fail at login." >&2
  exit 2
fi
if [[ $LDAP_SERVER == ldaps://* && ${LDAP_START_TLS:-} == true ]]; then
  echo "LDAP_SERVER is ldaps:// (implicit TLS) — LDAP_START_TLS must be false." >&2
  exit 2
fi

if [[ $DRY_RUN == 0 ]] && ! aws sts get-caller-identity --output text >/dev/null 2>&1; then
  echo "AWS credentials are not valid — re-authenticate before deploying." >&2
  exit 3
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

publish_template() {
  local src=$1 key=$2
  if [[ $DRY_RUN == 1 ]]; then
    echo "DRY:s3://$SCRATCH_BUCKET/$key"
    return
  fi
  if ! aws s3api head-bucket --bucket "$SCRATCH_BUCKET" >/dev/null 2>&1; then
    echo "creating scratch bucket s3://$SCRATCH_BUCKET in $AWS_REGION" >&2
    aws s3api create-bucket --bucket "$SCRATCH_BUCKET" --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
  fi
  aws s3 cp "$src" "s3://$SCRATCH_BUCKET/$key" >/dev/null
  local url="https://$SCRATCH_BUCKET.s3.$AWS_REGION.amazonaws.com/$key"
  aws cloudformation validate-template --template-url "$url" >/dev/null
  echo "$url"
}

common_params() {
  local domain=$1 cluster=$2
  if [[ ! $cluster =~ ^[a-z0-9][a-z0-9-]{0,24}$ ]]; then
    echo "cluster name '$cluster' breaks the template's ^[a-z0-9][a-z0-9-]{0,24}\$ pattern." >&2
    exit 2
  fi
  printf '%s\n' \
    "ClusterName=$cluster" \
    "DomainName=$domain" \
    "HostedZoneId=$HOSTED_ZONE_ID" \
    "LicenseKey=$LICENSE_KEY" \
    "DeploymentSize=$DEPLOYMENT_SIZE" \
    "EnableGpu=$ENABLE_GPU" \
    "EnableDemoLibrary=$ENABLE_DEMO_LIBRARY" \
    "DataLibrary1Name=$DATA_LIBRARY_1_NAME" \
    "DataLibrary1Bucket=$DATA_LIBRARY_1_BUCKET" \
    "DataLibrary1Region=$DATA_LIBRARY_1_REGION" \
    "DataLibrary1AccessKey=$DATA_LIBRARY_1_ACCESS_KEY" \
    "DataLibrary1SecretKey=$DATA_LIBRARY_1_SECRET_KEY"
}

ldap_params() {
  printf '%s\n' \
    "LdapServer=$LDAP_SERVER" \
    "LdapStartTLS=$LDAP_START_TLS" \
    "LdapBindDN=$LDAP_BIND_DN" \
    "LdapSearchRules=$LDAP_SEARCH_RULES" \
    "LdapSearchUser=$LDAP_SEARCH_USER" \
    "LdapSearchPassword=$LDAP_SEARCH_PASSWORD"
}

json_escape() { printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'; }

create_stack() {
  local name=$1 url=$2; shift 2
  local -a keys=() vals=()
  local line
  while IFS= read -r line; do
    [[ -z $line ]] && continue
    keys+=("${line%%=*}")
    vals+=("${line#*=}")
  done

  if [[ $DRY_RUN == 1 ]]; then
    printf -- '--- %s  (template %s)\n' "$name" "$url"
    local i
    for i in "${!keys[@]}"; do printf '    %-24s %s\n' "${keys[$i]}" "${vals[$i]}"; done
    return
  fi

  local json=$WORK/params-$name.json i sep=
  printf '[' > "$json"
  for i in "${!keys[@]}"; do
    printf '%s{"ParameterKey":"%s","ParameterValue":%s}' \
      "$sep" "${keys[$i]}" "$(json_escape "${vals[$i]}")" >> "$json"
    sep=,
  done
  printf ']' >> "$json"

  echo "creating $name from $url" >&2
  aws cloudformation create-stack \
    --stack-name "$name" \
    --template-url "$url" \
    --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
    --on-failure DO_NOTHING \
    --parameters "file://$json" \
    --output text --query 'StackId'
}

deploy_1() {
  local src=$WORK/cf-$TAG_REF.yaml url
  git -C "$REPO" show "$TAG_REF:$TEMPLATE_PATH" > "$src"
  url=$(publish_template "$src" "cf-$TAG_REF.yaml")
  { common_params "$STACK1_DOMAIN" "$STACK1_CLUSTER"
    ldap_params
    printf '%s\n' "AuthMethod=ldap" "AdminUsers=$STACK1_ADMIN_USERS"
  } | create_stack "$STACK1_NAME" "$url"
}

deploy_2() {
  local url
  url=$(publish_template "$REPO/$TEMPLATE_PATH" "cf-branch.yaml")
  { common_params "$STACK2_DOMAIN" "$STACK2_CLUSTER"
    ldap_params
    printf '%s\n' "AuthMethod=" "SsoProvider=none" "EnableLocalUsers=false" \
                  "LdapAdminUsers=$STACK2_LDAP_ADMIN_USERS"
  } | create_stack "$STACK2_NAME" "$url"
}

deploy_3() {
  local url
  url=$(publish_template "$REPO/$TEMPLATE_PATH" "cf-branch.yaml")
  { common_params "$STACK3_DOMAIN" "$STACK3_CLUSTER"
    printf '%s\n' "AuthMethod=" "SsoProvider=none" "EnableLocalUsers=false" "LdapServer="
  } | create_stack "$STACK3_NAME" "$url"
}

case $WHICH in
  1)   deploy_1 ;;
  2)   deploy_2 ;;
  3)   deploy_3 ;;
  all) deploy_1; deploy_2; deploy_3 ;;
esac
