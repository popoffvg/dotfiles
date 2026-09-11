#!/usr/bin/env bash
# Deploy a Platforma CloudFormation PR-preview stack from the platforma-cfn-pr bucket.
set -euo pipefail

PREVIEW_TAG="${PREVIEW_TAG:-4.4.2-7-2200-merge-chart}"
BUCKET="${BUCKET:-platforma-cfn-pr-511903394050}"
BUCKET_REGION="${BUCKET_REGION:-eu-central-1}"

AWS_PROFILE="${AWS_PROFILE:-research-poweruser}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
STACK="${STACK:?set STACK=<stack-name>}"
CLUSTER_NAME="${CLUSTER_NAME:-platforma-cluster}"
DOMAIN_NAME="${DOMAIN_NAME:?set DOMAIN_NAME=<fqdn>}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:?set HOSTED_ZONE_ID=<Z...>}"
PARAMS_EXTRA="${PARAMS_EXTRA:-}"

export AWS_PROFILE AWS_REGION

TEMPLATE_URL="https://${BUCKET}.s3.${BUCKET_REGION}.amazonaws.com/pr/${PREVIEW_TAG}/cloudformation-eks-1-35.yaml"
ASSET_BASE="s3://${BUCKET}/pr/${PREVIEW_TAG}"

params_file="$(mktemp -t cf-params-XXXXXX.json)"
trap 'rm -f "$params_file"' EXIT
cat > "$params_file" <<EOF
[
  {"ParameterKey":"ClusterName","ParameterValue":"${CLUSTER_NAME}"},
  {"ParameterKey":"DomainName","ParameterValue":"${DOMAIN_NAME}"},
  {"ParameterKey":"HostedZoneId","ParameterValue":"${HOSTED_ZONE_ID}"},
  {"ParameterKey":"DeployerAssetBaseUrl","ParameterValue":"${ASSET_BASE}"},
  {"ParameterKey":"DeployPlatforma","ParameterValue":"true"},
  {"ParameterKey":"SsoProvider","ParameterValue":"none"},
  {"ParameterKey":"EnableLocalUsers","ParameterValue":"true"}${PARAMS_EXTRA:+,
  ${PARAMS_EXTRA}}
]
EOF

echo "profile=${AWS_PROFILE} region=${AWS_REGION} stack=${STACK}"
echo "template=${TEMPLATE_URL}"
echo "assets=${ASSET_BASE}"
cat "$params_file"

aws sts get-caller-identity >/dev/null || aws sso login

if aws cloudformation describe-stacks --stack-name "$STACK" >/dev/null 2>&1; then
  change_set="update-$(date +%Y%m%d%H%M%S)"
  aws cloudformation create-change-set \
    --stack-name "$STACK" \
    --change-set-name "$change_set" \
    --change-set-type UPDATE \
    --template-url "$TEMPLATE_URL" \
    --parameters "file://$params_file" \
    --capabilities CAPABILITY_NAMED_IAM
  aws cloudformation wait change-set-create-complete \
    --stack-name "$STACK" --change-set-name "$change_set" || true
  aws cloudformation describe-change-set \
    --stack-name "$STACK" --change-set-name "$change_set" \
    --query 'Changes[].ResourceChange.{Action:Action,Type:ResourceType,Id:LogicalResourceId}' \
    --output table
  read -r -p "Execute change set ${change_set}? [y/N] " answer
  [ "$answer" = "y" ] || { echo "aborted"; exit 1; }
  aws cloudformation execute-change-set \
    --stack-name "$STACK" --change-set-name "$change_set"
  aws cloudformation wait stack-update-complete --stack-name "$STACK"
else
  aws cloudformation create-stack \
    --stack-name "$STACK" \
    --template-url "$TEMPLATE_URL" \
    --parameters "file://$params_file" \
    --capabilities CAPABILITY_NAMED_IAM
  aws cloudformation wait stack-create-complete --stack-name "$STACK"
fi

aws cloudformation describe-stacks --stack-name "$STACK" \
  --query 'Stacks[0].Outputs' --output table
