#!/usr/bin/env bash
# Engram session-stop hook — save session marker + export memories for git sync
# Triggered by: SessionEnd (all reasons)
set -euo pipefail

ENGRAM_BIN="${ENGRAM_BIN:-engram}"
PROJECT="park-pos"

if ! command -v "$ENGRAM_BIN" &>/dev/null; then
  echo "[engram] binary not found, skipping export" >&2
  exit 0
fi

# Read session info from stdin (Claude Code sends JSON)
SESSION_INFO=$(cat 2>/dev/null || echo "{}")
REASON=$(echo "$SESSION_INFO" | grep -o '"reason":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
SESSION_ID=$(echo "$SESSION_INFO" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")

# Save a session-end marker to Engram for timeline tracking
"$ENGRAM_BIN" save \
  "Session ended ($REASON)" \
  "Session $SESSION_ID closed. Reason: $REASON. Memories exported via sync." \
  --type session \
  --project "$PROJECT" \
  2>/dev/null || true

# Export new memories as git-syncable compressed chunks
"$ENGRAM_BIN" sync --project "$PROJECT" 2>/dev/null || true

echo "[engram] session $SESSION_ID ended ($REASON), memories exported" >&2
