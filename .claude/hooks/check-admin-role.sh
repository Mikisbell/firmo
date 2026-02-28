#!/usr/bin/env bash
# GUARDRAIL: Block role === 'ADMIN' — must use ADMIN_ROLES.includes()
# Triggered by: PreToolUse (Write|Edit)
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

# Skip test files
if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx)$ ]]; then
  exit 0
fi

# Block direct role comparison with 'ADMIN'
if echo "$CODE" | grep -qE "role\s*===?\s*['\"]ADMIN['\"]|role\s*!==?\s*['\"]ADMIN['\"]"; then
  echo '{"decision":"block","reason":"PARK RULE: role === ADMIN excluye OWNER/MANAGER/SUPERVISOR. Usar: ADMIN_ROLES.includes(role). Ver CLAUDE.md > Roles."}'
  exit 0
fi

exit 0
