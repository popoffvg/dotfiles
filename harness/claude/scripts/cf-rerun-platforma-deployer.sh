#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Re-run a Platforma CloudFormation stack's platforma-deployer CodeBuild project
against the cluster that stack already built, with overrides — so a failed helm
release can be retried in ~3 minutes instead of recreating the whole stack.

  cf-rerun-platforma-deployer.sh --project NAME --region REGION
                                 [--profile PROFILE]
                                 [--image REPO:TAG] [--keep-release]
                                 [--env NAME=VALUE]... [--wait] [--dry-run]

  --project NAME     CodeBuild project, e.g. <cluster>-platforma-deployer
  --image REPO:TAG   value for PLATFORMA_IMAGE. Empty on the project means the
                     chart's appVersion default (a released quay.io image), which
                     is rarely what a branch preview wants.
  --keep-release     strip `--atomic` from the helm command in the buildspec, so a
                     failing release is NOT uninstalled and its pod (and its log)
                     survive for diagnosis.
  --env NAME=VALUE   any further environment override; repeatable.
  --wait             block until the build reaches a terminal phase, then print it.
  --dry-run          print the overrides and the patched helm line, call nothing.

The build reports to CloudFormation through CFN_RESPONSE_URL, which is passed per
invocation by the custom resource and is absent here: the POST_BUILD curl fails
harmlessly and the stack's own status does not change. Use this to learn whether a
parameter set works, then recreate the stack with it.
EOF
}

PROJECT= REGION= PROFILE= IMAGE= KEEP_RELEASE=0 WAIT=0 DRY_RUN=0
EXTRA_ENV=()
IMAGE_SET=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --project) PROJECT=$2; shift 2 ;;
    --region)  REGION=$2; shift 2 ;;
    --profile) PROFILE=$2; shift 2 ;;
    --image)   IMAGE=$2; IMAGE_SET=1; shift 2 ;;
    --env)     EXTRA_ENV+=("$2"); shift 2 ;;
    --keep-release) KEEP_RELEASE=1; shift ;;
    --wait)    WAIT=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n $PROJECT && -n $REGION ]] || { echo "--project and --region are required" >&2; usage >&2; exit 2; }

export AWS_DEFAULT_REGION=$REGION
[[ -n $PROFILE ]] && export AWS_PROFILE=$PROFILE

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

aws codebuild batch-get-projects --names "$PROJECT" \
  --query 'projects[0].source.buildspec' --output text > "$WORK/buildspec.yml"
[[ -s $WORK/buildspec.yml ]] || { echo "no inline buildspec on project $PROJECT" >&2; exit 3; }

BUILDSPEC_ARG=()
if [[ $KEEP_RELEASE == 1 ]]; then
  # `--atomic` makes helm uninstall a release that misses its timeout, which
  # deletes the pod that holds the only copy of the failure log.
  # Leading whitespace has to survive: the buildspec is a YAML literal block, and
  # a line indented less than the block terminates it.
  perl -pi -e 's/--atomic[ \t]+//g; s/[ \t]+--atomic$//g' "$WORK/buildspec.yml"
  grep -n -- "--timeout" "$WORK/buildspec.yml" | sed 's/^/  patched: /' >&2
  BUILDSPEC_ARG=(--buildspec-override "$(cat "$WORK/buildspec.yml")")
fi

OVERRIDES=()
[[ $IMAGE_SET == 1 ]] && OVERRIDES+=("name=PLATFORMA_IMAGE,value=$IMAGE,type=PLAINTEXT")
for e in ${EXTRA_ENV+"${EXTRA_ENV[@]}"}; do
  OVERRIDES+=("name=${e%%=*},value=${e#*=},type=PLAINTEXT")
done

if [[ $DRY_RUN == 1 ]]; then
  echo "project:      $PROJECT ($REGION${PROFILE:+, profile $PROFILE})"
  echo "keep-release: $KEEP_RELEASE"
  printf 'override:     %s\n' ${OVERRIDES+"${OVERRIDES[@]}"}
  exit 0
fi

BUILD_ID=$(aws codebuild start-build --project-name "$PROJECT" \
  ${OVERRIDES+--environment-variables-override} ${OVERRIDES+"${OVERRIDES[@]}"} \
  ${BUILDSPEC_ARG+"${BUILDSPEC_ARG[@]}"} \
  --query 'build.id' --output text)
echo "$BUILD_ID"

[[ $WAIT == 0 ]] && exit 0

while :; do
  read -r status phase < <(aws codebuild batch-get-builds --ids "$BUILD_ID" \
    --query 'builds[0].[buildStatus,currentPhase]' --output text)
  [[ $status != IN_PROGRESS ]] && { echo "$status ($phase)"; break; }
  sleep 20
done
