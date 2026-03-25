#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# log-agent.sh — Run an OpenClaw agent and log everything
#
# Usage:
#   ./log-agent.sh <agent-id> <task-name> "<message>"
#
# Logs to: logs/build-log.jsonl and BUILD_LOG.md
# ─────────────────────────────────────────────────────────────────

AGENT_ID="${1:-main}"
TASK_NAME="${2:-unnamed}"
MESSAGE="${3:-}"
LOG_DIR="$(dirname "$0")/logs"
JSONL_LOG="$LOG_DIR/build-log.jsonl"
MD_LOG="$(dirname "$0")/BUILD_LOG.md"

mkdir -p "$LOG_DIR"

START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
START_EPOCH=$(date +%s)
SESSION_ID="session-$(date +%s)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🤖 Agent: $AGENT_ID"
echo "  📋 Task:  $TASK_NAME"
echo "  🕐 Start: $START_TIME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run the agent and capture output + exit code
RESPONSE=$(openclaw agent \
  --agent "$AGENT_ID" \
  --session-id "$SESSION_ID" \
  --message "$MESSAGE" \
  2>&1)
EXIT_CODE=$?

END_EPOCH=$(date +%s)
DURATION=$((END_EPOCH - START_EPOCH))
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

STATUS="success"
STUCK="false"
RECOVERY=""

if [ $EXIT_CODE -ne 0 ]; then
  STATUS="error"
  STUCK="true"
  RECOVERY="Exit code $EXIT_CODE — see response for details"
elif echo "$RESPONSE" | grep -qiE "error|failed|cannot|unable|stuck|retry|timeout"; then
  STATUS="partial"
  STUCK="true"
  RECOVERY="Agent encountered issues — see response"
fi

echo ""
echo "  ✅ Done in ${DURATION}s (status: $STATUS)"
echo ""
echo "── Response ──────────────────────────────────────────"
echo "$RESPONSE"
echo "──────────────────────────────────────────────────────"

# Write JSONL log
python3 -c "
import json, sys
entry = {
  'session_id': '$SESSION_ID',
  'agent': '$AGENT_ID',
  'task': '$TASK_NAME',
  'query': $(echo "$MESSAGE" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
  'response': $(echo "$RESPONSE" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
  'start': '$START_TIME',
  'end': '$END_TIME',
  'duration_s': $DURATION,
  'status': '$STATUS',
  'stuck': $STUCK,
  'recovery': '$RECOVERY',
  'exit_code': $EXIT_CODE
}
print(json.dumps(entry))
" >> "$JSONL_LOG"

# Append to BUILD_LOG.md
ROW="| $(cat "$JSONL_LOG" | wc -l | tr -d ' ') | $START_TIME | \`$AGENT_ID\` | $TASK_NAME | $STATUS | $STUCK | $RECOVERY |"
sed -i '' "s/| # | Time |.*|/$&\n$ROW/" "$MD_LOG" 2>/dev/null || echo "$ROW" >> "$MD_LOG"

echo ""
echo "  📝 Logged to: $JSONL_LOG"
echo ""
