#!/usr/bin/env bash
# GUARDRAIL: Block new PrismaClient() — must use singleton
# Triggered by: PreToolUse (Write|Edit)
# Exit 0 + decision:block = hard block. Exit 0 without JSON = allow.
set -euo pipefail

INPUT=$(cat 2>/dev/null || echo "{}")

FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
NEW_STRING=$(echo "$INPUT" | grep -o '"new_string":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
CONTENT=$(echo "$INPUT" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

CODE="${NEW_STRING}${CONTENT}"

# Only check .ts/.tsx files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Allow the singleton file itself
if [[ "$FILE_PATH" =~ "core/db/prisma.ts" ]]; then
  exit 0
fi

# Block new PrismaClient()
if echo "$CODE" | grep -q "new PrismaClient"; then
  echo '{"decision":"block","reason":"PARK RULE: new PrismaClient() prohibido. Usar: import prisma from @/src/core/db/prisma (singleton). Ver CLAUDE.md > Database."}'
  exit 0
fi

exit 0
