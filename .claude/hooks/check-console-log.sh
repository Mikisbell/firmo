#!/usr/bin/env bash
# GUARDRAIL: Warn about console.log in server files
# Triggered by: PostToolUse (Write|Edit)
# Soft warning via additionalContext, does not block.
set -euo pipefail

INPUT=$(cat 2>/dev/null || echo "{}")

FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

# Only check server-side files (API routes + core)
if [[ ! "$FILE_PATH" =~ (src/app/api|src/core)/.*\.(ts|js)$ ]]; then
  exit 0
fi

# Skip test files
if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|js)$ ]]; then
  exit 0
fi

# Check the actual file on disk for console.log
if [ -f "$FILE_PATH" ] && grep -q "console\.log" "$FILE_PATH" 2>/dev/null; then
  COUNT=$(grep -c "console\.log" "$FILE_PATH" 2>/dev/null || echo "0")
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"PARK WARNING: $COUNT console.log() en $FILE_PATH. Usar structured logger (Pino): import { createLogger } from @/src/core/observability/logger.\"}}"
fi

exit 0
