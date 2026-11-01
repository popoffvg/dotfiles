---
name: greptile-rule-review.sh
description: Start one read-only pi agent per .greptile/config.json rule as a bg task, each checking the branch diff against that one rule on Amazon Bedrock and writing PASS or FAIL to a file.
args: "[--dry-run] [<base-ref>]"
needs: git, jq, pi, background (bg), AWS credentials for Bedrock
env: GREPTILE_REVIEW_PROVIDER (default amazon-bedrock), GREPTILE_REVIEW_MODEL (default openai.gpt-oss-120b)
---
