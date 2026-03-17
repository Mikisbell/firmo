#!/usr/bin/env bash

################################################################################
# GGA-Engram Bridge
#
# Purpose: Bridge between GGA code review tool and Engram memory persistence
#
# This script captures GGA review violations and persists them to Engram's
# memory system via MCP protocol. It enables the Kiro orchestrator to query
# violation history and identify recurring code review issues.
#
# Design Principles:
#   - Non-invasive: Executes after GGA completes, preserving all existing behavior
#   - Fail-safe: Bridge errors never block git commits or hide GGA output
#   - Idempotent: Violations use deterministic topic_keys for safe re-processing
#   - Observable: All bridge operations are logged for debugging
#   - Configurable: Environment variable controls enable/disable without code changes
#
# Environment Variables:
#   GGA_ENGRAM_BRIDGE_ENABLED - Set to "true" to enable bridge (default: disabled)
#   ENGRAM_MCP_SERVER_PATH    - Path to engram binary (default: "engram")
#   GGA_BRIDGE_LOG_LEVEL      - Log level: debug|info|warn|error (default: "info")
#
# Usage:
#   Called from .git/hooks/pre-commit after GGA runs:
#   echo "$GGA_OUTPUT" | bash scripts/gga-engram-bridge.sh
#
# Exit Code:
#   Always exits with 0 to never block git commits
#
################################################################################

set -euo pipefail

# Configuration
readonly BRIDGE_VERSION="1.0.0"
readonly LOG_PREFIX="[GGA-BRIDGE]"
readonly DEFAULT_LOG_LEVEL="${GGA_BRIDGE_LOG_LEVEL:-info}"
readonly ENGRAM_SERVER="${ENGRAM_MCP_SERVER_PATH:-engram}"
readonly PROJECT_NAME="park-pos"

################################################################################
# Logging Functions
################################################################################

log_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log_debug() {
  if [[ "$DEFAULT_LOG_LEVEL" == "debug" ]]; then
    echo "$LOG_PREFIX [DEBUG] [$(log_timestamp)] $*" >&2
  fi
}

log_info() {
  if [[ "$DEFAULT_LOG_LEVEL" =~ ^(debug|info)$ ]]; then
    echo "$LOG_PREFIX [INFO] [$(log_timestamp)] $*" >&2
  fi
}

log_warn() {
  if [[ "$DEFAULT_LOG_LEVEL" =~ ^(debug|info|warn)$ ]]; then
    echo "$LOG_PREFIX [WARN] [$(log_timestamp)] $*" >&2
  fi
}

log_error() {
  echo "$LOG_PREFIX [ERROR] [$(log_timestamp)] $*" >&2
}

################################################################################
# Configuration Check
################################################################################

check_bridge_enabled() {
  if [[ "${GGA_ENGRAM_BRIDGE_ENABLED:-false}" != "true" ]]; then
    log_info "Bridge disabled (GGA_ENGRAM_BRIDGE_ENABLED != true)"
    return 1
  fi
  log_info "Bridge enabled, processing GGA output"
  return 0
}

################################################################################
# GGA Output Parser
################################################################################

# Global variables to store parsed data
declare -g GGA_STATUS=""
declare -ag GGA_VIOLATIONS=()

parse_gga_output() {
  log_debug "Parsing GGA output..."
  
  local input=""
  local line=""
  
  # Read all input from stdin
  while IFS= read -r line; do
    input+="$line"$'\n'
  done
  
  # Handle empty input
  if [[ -z "$input" ]]; then
    log_warn "Empty GGA output received"
    GGA_STATUS="UNKNOWN"
    return 0
  fi
  
  # Extract STATUS field
  if [[ "$input" =~ STATUS:[[:space:]]*(PASSED|FAILED) ]]; then
    GGA_STATUS="${BASH_REMATCH[1]}"
    log_debug "Extracted STATUS: $GGA_STATUS"
  else
    log_warn "No STATUS field found in GGA output, assuming PASSED"
    GGA_STATUS="PASSED"
    return 0
  fi
  
  # If PASSED, no violations to parse
  if [[ "$GGA_STATUS" == "PASSED" ]]; then
    log_debug "Status is PASSED, no violations to parse"
    return 0
  fi
  
  # Parse violations
  local violation_count=0
  local current_violation=""
  local in_violation=false
  
  while IFS= read -r line; do
    # Check if this is the start of a new violation (numbered line with **)
    if [[ "$line" =~ ^[[:space:]]*[0-9]+\.[[:space:]]*\*\*.+\*\* ]]; then
      # Save previous violation if exists
      if [[ -n "$current_violation" ]]; then
        extract_violation_fields "$current_violation" || true
        violation_count=$((violation_count + 1))
      fi
      # Start new violation
      current_violation="$line"$'\n'
      in_violation=true
    elif [[ "$in_violation" == true ]]; then
      # Check if we've hit the end of violations (empty line followed by non-violation content)
      if [[ -z "$line" ]]; then
        # Empty line might be end of violation or just spacing
        current_violation+="$line"$'\n'
      elif [[ "$line" =~ ^[[:space:]]*- ]]; then
        # This is part of the violation (Issue or Fix line)
        current_violation+="$line"$'\n'
      else
        # Non-violation line, save current violation and stop
        if [[ -n "$current_violation" ]]; then
          extract_violation_fields "$current_violation" || true
          violation_count=$((violation_count + 1))
        fi
        current_violation=""
        in_violation=false
      fi
    fi
  done <<< "$input"
  
  # Save last violation if exists
  if [[ -n "$current_violation" ]]; then
    extract_violation_fields "$current_violation" || true
    violation_count=$((violation_count + 1))
  fi
  
  log_info "Parsed $violation_count violations from GGA output"
  return 0
}

extract_violation_fields() {
  local violation_block="$1"
  
  log_debug "Extracting fields from violation block"
  
  # Initialize variables
  local file=""
  local line_num=""
  local rule=""
  local message=""
  local suggestion=""
  
  # Extract file, line, and rule from first line
  # Format: 1. **src/components/Button.tsx:3** - TypeScript Rule
  local first_line=$(echo "$violation_block" | head -n 1)
  if [[ "$first_line" =~ \*\*([^:]+):([0-9]+)\*\*[[:space:]]*-[[:space:]]*(.+)$ ]]; then
    file="${BASH_REMATCH[1]}"
    line_num="${BASH_REMATCH[2]}"
    rule="${BASH_REMATCH[3]}"
    # Trim trailing whitespace
    rule=$(echo "$rule" | xargs)
  else
    log_warn "Failed to parse violation header, skipping block"
    return 0
  fi
  
  # Extract message (Issue line)
  # Use grep to find the Issue line and extract everything after "Issue:"
  local issue_line=$(echo "$violation_block" | grep -E "^[[:space:]]*-[[:space:]]*Issue:" | head -n 1)
  if [[ "$issue_line" =~ Issue:[[:space:]]*(.+)$ ]]; then
    message="${BASH_REMATCH[1]}"
    message=$(echo "$message" | xargs)
  else
    log_warn "No Issue field found in violation block"
    message="No message provided"
  fi
  
  # Extract suggestion (Fix line)
  # Use grep to find the Fix line and extract everything after "Fix:"
  local fix_line=$(echo "$violation_block" | grep -E "^[[:space:]]*-[[:space:]]*Fix:" | head -n 1)
  if [[ "$fix_line" =~ Fix:[[:space:]]*(.+)$ ]]; then
    suggestion="${BASH_REMATCH[1]}"
    suggestion=$(echo "$suggestion" | xargs)
  else
    log_warn "No Fix field found in violation block"
    suggestion="No suggestion provided"
  fi
  
  # Store violation as a formatted string (we'll parse it later when saving)
  # Format: file|line|rule|message|suggestion
  local violation_data="$file|$line_num|$rule|$message|$suggestion"
  GGA_VIOLATIONS+=("$violation_data")
  
  log_debug "Extracted violation: file=$file, line=$line_num, rule=$rule"
  
  return 0
}

################################################################################
# Git Metadata Collector
################################################################################

# Global variables to store git metadata
declare -g GIT_COMMIT_HASH=""
declare -g GIT_BRANCH=""
declare -g GIT_TIMESTAMP=""

capture_git_metadata() {
  log_debug "Capturing git metadata..."
  
  # Capture commit hash (or "uncommitted" if not in git repo)
  GIT_COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "uncommitted")
  
  # Capture branch name (or "unknown" if not in git repo)
  GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  
  # Capture timestamp in ISO 8601 UTC format
  GIT_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # Log warning if git metadata is unavailable
  if [[ "$GIT_COMMIT_HASH" == "uncommitted" ]]; then
    log_warn "Git metadata unavailable, using placeholders"
  else
    log_debug "Captured git metadata: commit=$GIT_COMMIT_HASH, branch=$GIT_BRANCH, timestamp=$GIT_TIMESTAMP"
  fi
  
  return 0
}

################################################################################
# MCP Client Integration
################################################################################

connect_to_engram() {
  log_debug "Checking Engram MCP server availability..."
  
  # Check if engram binary exists
  if ! command -v "$ENGRAM_SERVER" &> /dev/null; then
    log_error "Engram binary not found at path '$ENGRAM_SERVER'"
    return 1
  fi
  
  log_debug "Engram binary found at: $(command -v "$ENGRAM_SERVER")"
  return 0
}

save_violation() {
  local violation_data="$1"
  
  # Parse violation data (format: file|line|rule|message|suggestion)
  IFS='|' read -r file line_num rule message suggestion <<< "$violation_data"
  
  log_debug "Saving violation: $rule in $file:$line_num"
  
  # Extract filename from path for title
  local filename=$(basename "$file")
  
  # Generate topic_key: gga-violation-{commit_hash}-{file}-{line}
  local topic_key="gga-violation-${GIT_COMMIT_HASH}-${file}-${line_num}"
  
  # Generate title: {rule} violation in {file}:{line}
  local title="${rule} violation in ${filename}:${line_num}"
  
  # Format content as JSON
  local content=$(jq -n \
    --arg file "$file" \
    --arg line "$line_num" \
    --arg rule "$rule" \
    --arg message "$message" \
    --arg suggestion "$suggestion" \
    --arg commit_hash "$GIT_COMMIT_HASH" \
    --arg timestamp "$GIT_TIMESTAMP" \
    --arg branch "$GIT_BRANCH" \
    '{
      file: $file,
      line: ($line | tonumber),
      rule: $rule,
      message: $message,
      suggestion: $suggestion,
      commit_hash: $commit_hash,
      timestamp: $timestamp,
      branch: $branch
    }')
  
  # Format MCP JSON-RPC request for mem_save
  local mcp_request=$(jq -n \
    --arg title "$title" \
    --arg type "code-review-violation" \
    --arg content "$content" \
    --arg topic_key "$topic_key" \
    --arg scope "project" \
    --arg project "$PROJECT_NAME" \
    '{
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "mem_save",
        arguments: {
          title: $title,
          type: $type,
          content: $content,
          topic_key: $topic_key,
          scope: $scope,
          project: $project
        }
      }
    }')
  
  log_debug "MCP request: $mcp_request"
  
  # Call engram binary via stdio with 5-second timeout
  local response=""
  if response=$(echo "$mcp_request" | timeout 5 "$ENGRAM_SERVER" 2>&1); then
    log_debug "Violation saved successfully: $topic_key"
    log_debug "MCP response: $response"
    return 0
  else
    local exit_code=$?
    if [[ $exit_code -eq 124 ]]; then
      log_error "Timeout saving violation (5 seconds exceeded): $topic_key"
    else
      log_error "Failed to save violation: $topic_key (exit code: $exit_code)"
      log_error "Error output: $response"
    fi
    return 1
  fi
}

save_summary() {
  log_debug "Aggregating violation statistics for summary..."
  
  # Count total violations
  local total_violations=${#GGA_VIOLATIONS[@]}
  
  # Extract unique rules
  local -a unique_rules=()
  local -a files_affected=()
  
  for violation_data in "${GGA_VIOLATIONS[@]}"; do
    IFS='|' read -r file line_num rule message suggestion <<< "$violation_data"
    
    # Add rule to unique_rules if not already present
    if [[ ! " ${unique_rules[*]} " =~ " ${rule} " ]]; then
      unique_rules+=("$rule")
    fi
    
    # Add file to files_affected if not already present
    if [[ ! " ${files_affected[*]} " =~ " ${file} " ]]; then
      files_affected+=("$file")
    fi
  done
  
  log_debug "Summary stats: total=$total_violations, unique_rules=${#unique_rules[@]}, files=${#files_affected[@]}"
  
  # Generate topic_key: gga-summary-{commit_hash}
  local topic_key="gga-summary-${GIT_COMMIT_HASH}"
  
  # Generate title
  local title="GGA Review Summary - ${GIT_COMMIT_HASH}"
  
  # Format content as JSON
  local content=$(jq -n \
    --arg total_violations "$total_violations" \
    --argjson unique_rules "$(printf '%s\n' "${unique_rules[@]}" | jq -R . | jq -s .)" \
    --argjson files_affected "$(printf '%s\n' "${files_affected[@]}" | jq -R . | jq -s .)" \
    --arg commit_hash "$GIT_COMMIT_HASH" \
    --arg timestamp "$GIT_TIMESTAMP" \
    --arg branch "$GIT_BRANCH" \
    --arg status "$GGA_STATUS" \
    '{
      total_violations: ($total_violations | tonumber),
      unique_rules: $unique_rules,
      files_affected: $files_affected,
      commit_hash: $commit_hash,
      timestamp: $timestamp,
      branch: $branch,
      status: $status
    }')
  
  # Format MCP JSON-RPC request for mem_save
  local mcp_request=$(jq -n \
    --arg title "$title" \
    --arg type "code-review-summary" \
    --arg content "$content" \
    --arg topic_key "$topic_key" \
    --arg scope "project" \
    --arg project "$PROJECT_NAME" \
    '{
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "mem_save",
        arguments: {
          title: $title,
          type: $type,
          content: $content,
          topic_key: $topic_key,
          scope: $scope,
          project: $project
        }
      }
    }')
  
  log_debug "MCP request: $mcp_request"
  
  # Call engram binary via stdio with 5-second timeout
  local response=""
  if response=$(echo "$mcp_request" | timeout 5 "$ENGRAM_SERVER" 2>&1); then
    log_info "Summary saved successfully: $topic_key"
    log_debug "MCP response: $response"
    return 0
  else
    local exit_code=$?
    if [[ $exit_code -eq 124 ]]; then
      log_error "Timeout saving summary (5 seconds exceeded): $topic_key"
    else
      log_error "Failed to save summary: $topic_key (exit code: $exit_code)"
      log_error "Error output: $response"
    fi
    return 1
  fi
}

################################################################################
# Error Handling
################################################################################

handle_error() {
  local error_message="$1"
  log_error "$error_message"
  # Never exit with non-zero code to avoid blocking git commits
}

################################################################################
# Main Execution
################################################################################

main() {
  log_debug "GGA-Engram Bridge v${BRIDGE_VERSION} starting..."
  
  # Check if bridge is enabled
  if ! check_bridge_enabled; then
    exit 0
  fi
  
  # Parse GGA output from stdin
  if ! parse_gga_output; then
    log_error "Failed to parse GGA output"
    exit 0
  fi
  
  log_info "Successfully parsed GGA output: STATUS=$GGA_STATUS, violations=${#GGA_VIOLATIONS[@]}"
  
  # Capture git metadata
  if ! capture_git_metadata; then
    log_error "Failed to capture git metadata"
    exit 0
  fi
  
  # Connect to Engram MCP server
  if ! connect_to_engram; then
    log_error "Failed to connect to Engram, skipping violation persistence"
    exit 0
  fi
  
  # Save each violation to Engram (fail-safe: continue on errors)
  local saved_count=0
  local failed_count=0
  
  for violation_data in "${GGA_VIOLATIONS[@]}"; do
    if save_violation "$violation_data"; then
      saved_count=$((saved_count + 1))
    else
      failed_count=$((failed_count + 1))
      # Continue processing remaining violations (fail-safe)
    fi
  done
  
  log_info "Saved $saved_count violations, $failed_count failed"
  
  # Save summary (even if some violations failed)
  if ! save_summary; then
    log_error "Failed to save summary"
  fi
  
  # Always exit successfully
  exit 0
}

# Execute main function
main "$@"
