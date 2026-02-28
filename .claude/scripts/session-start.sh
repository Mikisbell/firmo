#!/usr/bin/env bash
# Engram session-start hook — import memories + inject context into agent
# Triggered by: SessionStart (startup | resume)
# Output on stdout is injected into the agent's context as a system message
set -euo pipefail

ENGRAM_BIN="${ENGRAM_BIN:-engram}"
PROJECT="park-pos"

if ! command -v "$ENGRAM_BIN" &>/dev/null; then
  echo "[engram] binary not found, skipping memory load" >&2
  exit 0
fi

# Import git-synced chunks if manifest exists
if [ -f ".engram/manifest.json" ]; then
  "$ENGRAM_BIN" sync --import 2>/dev/null || true
fi

# Inject context into agent via stdout
# Claude Code captures stdout and presents it as system context
CONTEXT=$("$ENGRAM_BIN" context "$PROJECT" 2>/dev/null || echo "")
STATS=$("$ENGRAM_BIN" stats 2>/dev/null || echo "")

if [ -n "$CONTEXT" ]; then
  cat <<EOF
## Engram Memory Loaded

### Stats
$(echo "$STATS" | grep -E "Sessions|Observations|Prompts" || true)

### Previous Context
${CONTEXT}

> Use mem_search to find specific memories. Use mem_save after decisions/bugs/discoveries.
EOF
fi
