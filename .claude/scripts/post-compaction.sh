#!/usr/bin/env bash
# Engram post-compaction hook — recover context after context window compression
# Triggered by: SessionStart (compact)
# After compaction, the agent loses all in-memory context. This hook
# re-injects critical memories so the agent can continue coherently.
set -euo pipefail

ENGRAM_BIN="${ENGRAM_BIN:-engram}"
PROJECT="park-pos"

if ! command -v "$ENGRAM_BIN" &>/dev/null; then
  echo "[engram] binary not found, context recovery skipped" >&2
  exit 0
fi

# Re-import chunks in case new ones were synced mid-session
if [ -f ".engram/manifest.json" ]; then
  "$ENGRAM_BIN" sync --import 2>/dev/null || true
fi

# Inject recovered context via stdout
CONTEXT=$("$ENGRAM_BIN" context "$PROJECT" 2>/dev/null || echo "")

if [ -n "$CONTEXT" ]; then
  cat <<EOF
## Engram Context Recovered (post-compaction)

The context window was compacted. Previous conversation is summarized above.
Below are your persistent memories from Engram to help you continue:

${CONTEXT}

> IMPORTANT: You lost in-context details. Use mem_search for specifics before continuing work.
> Remember: mem_save after every decision, mem_session_summary before closing.
EOF
fi
