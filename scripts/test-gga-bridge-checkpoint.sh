#!/usr/bin/env bash

################################################################################
# GGA-Engram Bridge Checkpoint Test
#
# Purpose: Verify that parser and git metadata functions work correctly
#
# This script tests:
#   1. Parser functions (Task 2):
#      - parse_gga_output() extracts STATUS and violations
#      - extract_violation_fields() parses file, line, rule, message, suggestion
#   2. Git metadata collector (Task 3):
#      - capture_git_metadata() captures commit hash, branch, timestamp
#      - Placeholders work in non-git environments
#
# Exit Code:
#   0 if all tests pass
#   1 if any test fails
#
################################################################################

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

################################################################################
# Test Utilities
################################################################################

print_header() {
  echo ""
  echo "=========================================="
  echo "$1"
  echo "=========================================="
}

print_test() {
  echo ""
  echo "Test: $1"
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local test_name="$3"
  
  TESTS_RUN=$((TESTS_RUN + 1))
  
  if [[ "$expected" == "$actual" ]]; then
    echo -e "${GREEN}✓${NC} $test_name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗${NC} $test_name"
    echo "  Expected: $expected"
    echo "  Actual:   $actual"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local test_name="$3"
  
  TESTS_RUN=$((TESTS_RUN + 1))
  
  if [[ "$haystack" == *"$needle"* ]]; then
    echo -e "${GREEN}✓${NC} $test_name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗${NC} $test_name"
    echo "  Expected to contain: $needle"
    echo "  Actual: $haystack"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

assert_not_empty() {
  local value="$1"
  local test_name="$2"
  
  TESTS_RUN=$((TESTS_RUN + 1))
  
  if [[ -n "$value" ]]; then
    echo -e "${GREEN}✓${NC} $test_name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗${NC} $test_name"
    echo "  Expected non-empty value"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

################################################################################
# Test Data
################################################################################

# Sample GGA output with PASSED status
readonly SAMPLE_PASSED_OUTPUT="STATUS: PASSED

No violations found. Code review complete."

# Sample GGA output with FAILED status and violations
readonly SAMPLE_FAILED_OUTPUT="STATUS: FAILED

Violations found:

1. **src/components/Button.tsx:3** - TypeScript Rule
   - Issue: Using \`any\` type for props
   - Fix: Define proper interface for ButtonProps

2. **src/utils/money.ts:15** - Money Rule
   - Issue: Using float for money calculation
   - Fix: Use integer cents (Centavos type)

3. **src/api/routes/auth.ts:42** - Security Rule
   - Issue: tenant_id from request body instead of JWT
   - Fix: Use authResult.user.tenantId from JWT"

################################################################################
# Parser Tests
################################################################################

test_parser_passed_status() {
  print_test "Parser extracts PASSED status correctly"
  
  # Run bridge with PASSED output
  local output=$(echo "$SAMPLE_PASSED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "STATUS=PASSED" "Output should contain STATUS=PASSED"
  assert_contains "$output" "violations=0" "Output should contain violations=0"
}

test_parser_failed_status() {
  print_test "Parser extracts FAILED status correctly"
  
  # Run bridge with FAILED output
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "STATUS=FAILED" "Output should contain STATUS=FAILED"
  assert_contains "$output" "violations=3" "Output should contain violations=3"
}

test_parser_empty_output() {
  print_test "Parser handles empty output gracefully"
  
  # Run bridge with empty output (echo "" sends a newline, so it's not truly empty)
  # The parser will see no STATUS field and default to PASSED
  local output=$(echo "" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "No STATUS field found" "Output should contain warning about missing STATUS"
  assert_contains "$output" "STATUS=PASSED" "Output should default to PASSED"
}

test_parser_no_status_field() {
  print_test "Parser handles missing STATUS field"
  
  # Run bridge with output without STATUS field
  local output=$(echo "Some random output without STATUS" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "No STATUS field found" "Output should contain warning about missing STATUS"
  assert_contains "$output" "STATUS=PASSED" "Output should default to PASSED"
}

################################################################################
# Git Metadata Tests
################################################################################

test_git_metadata_capture() {
  print_test "Git metadata collector captures commit, branch, and timestamp"
  
  # Run bridge and check for git metadata in logs
  local output=$(echo "$SAMPLE_PASSED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true GGA_BRIDGE_LOG_LEVEL=debug bash scripts/gga-engram-bridge.sh 2>&1)
  
  # Check that git metadata capture was attempted
  assert_contains "$output" "Capturing git metadata" "Output should show git metadata capture"
  
  # Check for either real git metadata or placeholder warning
  if git rev-parse --git-dir > /dev/null 2>&1; then
    # In a git repo - should have real metadata or uncommitted placeholder
    if [[ "$output" == *"Git metadata unavailable"* ]]; then
      echo -e "${YELLOW}⚠${NC} Using placeholder git metadata (might be in pre-commit state)"
      TESTS_PASSED=$((TESTS_PASSED + 1))
    else
      echo -e "${GREEN}✓${NC} Captured real git metadata"
      TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
  else
    # Not in a git repo - should have placeholder warning
    assert_contains "$output" "Git metadata unavailable" "Output should warn about unavailable git metadata"
  fi
  TESTS_RUN=$((TESTS_RUN + 1))
}

################################################################################
# Configuration Tests
################################################################################

test_bridge_disabled() {
  print_test "Bridge skips processing when disabled"
  
  # Run bridge with disabled flag
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=false bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "Bridge disabled" "Output should indicate bridge is disabled"
}

test_bridge_enabled() {
  print_test "Bridge processes output when enabled"
  
  # Run bridge with enabled flag
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "Bridge enabled" "Output should indicate bridge is enabled"
  assert_contains "$output" "Successfully parsed GGA output" "Output should show successful parsing"
}

################################################################################
# Integration Tests
################################################################################

test_end_to_end_passed() {
  print_test "End-to-end test with PASSED status"
  
  # Run complete bridge flow
  local output=$(echo "$SAMPLE_PASSED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "Bridge enabled" "Bridge should be enabled"
  assert_contains "$output" "STATUS=PASSED" "Should parse PASSED status"
  assert_contains "$output" "violations=0" "Should have 0 violations"
}

test_end_to_end_failed() {
  print_test "End-to-end test with FAILED status"
  
  # Run complete bridge flow
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "Bridge enabled" "Bridge should be enabled"
  assert_contains "$output" "STATUS=FAILED" "Should parse FAILED status"
  assert_contains "$output" "violations=3" "Should have 3 violations"
}

test_exit_code_always_zero() {
  print_test "Bridge always exits with code 0"
  
  # Run bridge with various inputs and check exit code
  echo "$SAMPLE_PASSED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1
  local exit_code=$?
  assert_equals "0" "$exit_code" "Exit code should be 0 for PASSED"
  
  echo "$SAMPLE_FAILED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1
  exit_code=$?
  assert_equals "0" "$exit_code" "Exit code should be 0 for FAILED"
  
  echo "" | GGA_ENGRAM_BRIDGE_ENABLED=true bash scripts/gga-engram-bridge.sh 2>&1
  exit_code=$?
  assert_equals "0" "$exit_code" "Exit code should be 0 for empty input"
}

################################################################################
# Detailed Violation Parsing Tests
################################################################################

test_violation_field_extraction() {
  print_test "Violation fields are extracted correctly"
  
  # Run bridge with debug logging to see parsed violations
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | GGA_ENGRAM_BRIDGE_ENABLED=true GGA_BRIDGE_LOG_LEVEL=debug bash scripts/gga-engram-bridge.sh 2>&1)
  
  # Check that violations were extracted
  assert_contains "$output" "Extracted violation: file=src/components/Button.tsx" "First violation file extracted"
  assert_contains "$output" "line=3" "First violation line extracted"
  assert_contains "$output" "rule=TypeScript Rule" "First violation rule extracted"
  
  assert_contains "$output" "Extracted violation: file=src/utils/money.ts" "Second violation file extracted"
  assert_contains "$output" "line=15" "Second violation line extracted"
  assert_contains "$output" "rule=Money Rule" "Second violation rule extracted"
  
  assert_contains "$output" "Extracted violation: file=src/api/routes/auth.ts" "Third violation file extracted"
  assert_contains "$output" "line=42" "Third violation line extracted"
  assert_contains "$output" "rule=Security Rule" "Third violation rule extracted"
}

################################################################################
# Main Test Runner
################################################################################

main() {
  print_header "GGA-Engram Bridge Checkpoint Tests"
  
  echo "Testing parser and git metadata functions from Tasks 2 and 3"
  echo ""
  
  # Parser Tests
  print_header "Parser Tests (Task 2)"
  test_parser_passed_status
  test_parser_failed_status
  test_parser_empty_output
  test_parser_no_status_field
  test_violation_field_extraction
  
  # Git Metadata Tests
  print_header "Git Metadata Tests (Task 3)"
  test_git_metadata_capture
  
  # Configuration Tests
  print_header "Configuration Tests"
  test_bridge_disabled
  test_bridge_enabled
  
  # Integration Tests
  print_header "Integration Tests"
  test_end_to_end_passed
  test_end_to_end_failed
  test_exit_code_always_zero
  
  # Print summary
  print_header "Test Summary"
  echo ""
  echo "Tests run:    $TESTS_RUN"
  echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
  
  if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please review the failures above and fix any issues before proceeding to Task 5."
    exit 1
  else
    echo -e "Tests failed: ${GREEN}0${NC}"
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "Parser and git metadata functions are working correctly."
    echo "You can now proceed to Task 5 (MCP client integration)."
    exit 0
  fi
}

# Run tests
main "$@"
