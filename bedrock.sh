export AWS_PROFILE=Sanbox_NIM
export AWS_REGION="us-east-1"
export CLAUDE_CODE_USE_BEDROCK=1

aws sso login --profile Sanbox_NIM
claude --dangerously-skip-permissions
