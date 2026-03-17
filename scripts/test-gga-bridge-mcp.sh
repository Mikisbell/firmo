#!/usr/bin/env bash

################################################################################
# GGA-Engram Bridge MCP Integration Test
#
# Purpose: Verify that MCP client integration functions work correctly (Task 5)
#
# This script tests:
#   1. connect_to_engram() validates engram binary exists
#   2. save_violation() formats MCP JSON-RPC requests correctly
#   3. save_summary() aggregates stats and formats summary correctly
#   4. Timeout handling works (5 second default)
#   5. Error isolation - failures don't stop processing
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

################################################################################
# Test Data
################################################################################

# Sample GGA output with violations
readonly SAMPLE_FAILED_OUTPUT="STATUS: FAILED

Violations found:

1. **src/components/Button.tsx:3** - TypeScript Rule
   - Issue: Using \`any\` type for props
   - Fix: Define proper interface for ButtonProps

2. **src/utils/money.ts:15** - Money Rule
   - Issue: Using float for money calculation
   - Fix: Use integer cents (Centavos type)"

################################################################################
# MCP Integration Tests
################################################################################

test_connect_to_engram_not_found() {
  print_test "connect_to_engram() detects missing engram binary"
  
  # Run bridge with non-existent engram path
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | \
    GGA_ENGRAM_BRIDGE_ENABLED=true \
    ENGRAM_MCP_SERVER_PATH="/nonexistent/engram" \
    bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "Engram binary not found" "Should detect missing engram binary"
  assert_contains "$output" "Failed to connect to Engram" "Should log connection failure"
}

test_connect_to_engram_found() {
  print_test "connect_to_engram() succeeds when engram binary exists"
  
  # Create a mock engram binary
  local mock_engram="/tmp/mock-engram-$$"
  cat > "$mock_engram" << 'EOF'
#!/usr/bin/env bash
# Mock engram that returns success
echo '{"jsonrpc":"2.0","id":1,"result":{"success":true}}'
exit 0
EOF
  chmod +x "$mock_engram"
  
  # Run bridge with mock engram
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | \
    GGA_ENGRAM_BRIDGE_ENABLED=true \
    ENGRAM_MCP_SERVER_PATH="$mock_engram" \
    GGA_BRIDGE_LOG_LEVEL=debug \
    bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "Engram binary found" "Should find engram binary"
  assert_contains "$output" "Saving violation" "Should attempt to save violations"
  
  # Cleanup
  rm -f "$mock_engram"
}

test_save_violation_format() {
  print_test "save_violation() formats MCP JSON-RPC correctly"
  
  # Create a mock engram that captures only the first request
  local mock_engram="/tmp/mock-engram-capture-$$"
  local capture_file="/tmp/mcp-request-$$"
  cat > "$mock_engram" << EOF
#!/usr/bin/env bash
# Capture only first request (violation, not summary)
if [[ ! -f "$capture_file" ]]; then
  cat > "$capture_file"
fi
echo '{"jsonrpc":"2.0","id":1,"result":{"success":true}}'
exit 0
EOF
  chmod +x "$mock_engram"
  
  # Run bridge with mock engram
  echo "$SAMPLE_FAILED_OUTPUT" | \
    GGA_ENGRAM_BRIDGE_ENABLED=true \
    ENGRAM_MCP_SERVER_PATH="$mock_engram" \
    bash scripts/gga-engram-bridge.sh 2>&1 > /dev/null
  
  # Check captured MCP request (should be first violation)
  if [[ -f "$capture_file" ]]; then
    local mcp_request=$(cat "$capture_file")
    
    # Verify JSON-RPC structure (handle formatted JSON with spaces)
    assert_contains "$mcp_request" '"jsonrpc"' "Should have JSON-RPC version"
    assert_contains "$mcp_request" '"2.0"' "Should have JSON-RPC 2.0"
    assert_contains "$mcp_request" '"method"' "Should have method field"
    assert_contains "$mcp_request" '"tools/call"' "Should call tools/call method"
    assert_contains "$mcp_request" '"name"' "Should have name field"
    assert_contains "$mcp_request" '"mem_save"' "Should call mem_save tool"
    
    # Verify violation fields
    assert_contains "$mcp_request" '"type"' "Should have type field"
    assert_contains "$mcp_request" '"code-review-violation"' "Should have correct type"
    assert_contains "$mcp_request" '"scope"' "Should have scope field"
    assert_contains "$mcp_request" '"project"' "Should have project field"
    assert_contains "$mcp_request" '"park-pos"' "Should have park-pos project"
    assert_contains "$mcp_request" 'gga-violation-' "Should have topic_key with gga-violation prefix"
    
    # Verify content fields (these are inside the JSON string content)
    assert_contains "$mcp_request" 'file' "Should have file field"
    assert_contains "$mcp_request" 'src/components/Button.tsx' "Should have correct file"
    assert_contains "$mcp_request" 'line' "Should have line field"
    assert_contains "$mcp_request" 'rule' "Should have rule field"
    assert_contains "$mcp_request" 'TypeScript Rule' "Should have correct rule"
    assert_contains "$mcp_request" 'message' "Should have message field"
    assert_contains "$mcp_request" 'suggestion' "Should have suggestion field"
  else
    echo -e "${RED}✗${NC} MCP request not captured"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  
  # Cleanup
  rm -f "$mock_engram" "$capture_file"
}

test_save_summary_format() {
  print_test "save_summary() formats summary correctly"
  
  # Create a mock engram that captures all requests
  local mock_engram="/tmp/mock-engram-summary-$$"
  local capture_dir="/tmp/mcp-requests-$$"
  mkdir -p "$capture_dir"
  
  cat > "$mock_engram" << EOF
#!/usr/bin/env bash
# Capture each request to a separate file
request_num=\$(ls "$capture_dir" 2>/dev/null | wc -l)
cat > "$capture_dir/request-\$request_num.json"
echo '{"jsonrpc":"2.0","id":1,"result":{"success":true}}'
exit 0
EOF
  chmod +x "$mock_engram"
  
  # Run bridge with mock engram
  echo "$SAMPLE_FAILED_OUTPUT" | \
    GGA_ENGRAM_BRIDGE_ENABLED=true \
    ENGRAM_MCP_SERVER_PATH="$mock_engram" \
    bash scripts/gga-engram-bridge.sh 2>&1 > /dev/null
  
  # Find the summary request (should be the last one)
  local summary_file=$(ls -1 "$capture_dir"/*.json 2>/dev/null | tail -n 1)
  
  if [[ -f "$summary_file" ]]; then
    local summary_request=$(cat "$summary_file")
    
    # Verify it's a summary request (handle formatted JSON)
    assert_contains "$summary_request" '"type"' "Should have type field"
    assert_contains "$summary_request" '"code-review-summary"' "Should have summary type"
    assert_contains "$summary_request" 'gga-summary-' "Should have topic_key with gga-summary prefix"
    
    # Verify summary content (these are inside the JSON string content)
    assert_contains "$summary_request" 'total_violations' "Should have total_violations field"
    assert_contains "$summary_request" 'status' "Should have status field"
    assert_contains "$summary_request" 'FAILED' "Should have FAILED status"
    assert_contains "$summary_request" 'unique_rules' "Should have unique_rules array"
    assert_contains "$summary_request" 'files_affected' "Should have files_affected array"
  else
    echo -e "${RED}✗${NC} Summary request not captured"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  
  # Cleanup
  rm -rf "$mock_engram" "$capture_dir"
}

test_timeout_handling() {
  print_test "Timeout handling works (5 seconds)"
  
  # Create a mock engram that hangs
  local mock_engram="/tmp/mock-engram-hang-$$"
  cat > "$mock_engram" << 'EOF'
#!/usr/bin/env bash
# Hang for 10 seconds (longer than timeout)
sleep 10
echo '{"jsonrpc":"2.0","id":1,"result":{"success":true}}'
exit 0
EOF
  chmod +x "$mock_engram"
  
  # Run bridge with mock engram and measure time
  local start_time=$(date +%s)
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | \
    GGA_ENGRAM_BRIDGE_ENABLED=true \
    ENGRAM_MCP_SERVER_PATH="$mock_engram" \
    bash scripts/gga-engram-bridge.sh 2>&1)
  local end_time=$(date +%s)
  local elapsed=$((end_time - start_time))
  
  # Should timeout after ~5 seconds per violation + summary (allow generous margin for Windows)
  # With 2 violations + 1 summary = 3 calls, could take up to 15 seconds
  if [[ $elapsed -lt 20 ]]; then
    echo -e "${GREEN}✓${NC} Timeout occurred within expected time ($elapsed seconds)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} Timeout took too long ($elapsed seconds, expected <20)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  TESTS_RUN=$((TESTS_RUN + 1))
  
  assert_contains "$output" "Timeout saving violation" "Should log timeout error"
  
  # Cleanup
  rm -f "$mock_engram"
}

test_error_isolation() {
  print_test "Error isolation - failures don't stop processing"
  
  # Create a mock engram that fails on first call, succeeds on second
  local mock_engram="/tmp/mock-engram-fail-$$"
  local call_count_file="/tmp/call-count-$$"
  echo "0" > "$call_count_file"
  
  cat > "$mock_engram" << EOF
#!/usr/bin/env bash
# Fail on first call, succeed on subsequent calls
call_count=\$(cat "$call_count_file")
call_count=\$((call_count + 1))
echo "\$call_count" > "$call_count_file"

if [[ \$call_count -eq 1 ]]; then
  echo "Error: First call fails" >&2
  exit 1
else
  echo '{"jsonrpc":"2.0","id":1,"result":{"success":true}}'
  exit 0
fi
EOF
  chmod +x "$mock_engram"
  
  # Run bridge with mock engram
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | \
    GGA_ENGRAM_BRIDGE_ENABLED=true \
    ENGRAM_MCP_SERVER_PATH="$mock_engram" \
    bash scripts/gga-engram-bridge.sh 2>&1)
  
  # Should have attempted to save both violations despite first failure
  assert_contains "$output" "Failed to save violation" "Should log first failure"
  assert_contains "$output" "Saved 1 violations, 1 failed" "Should continue after failure"
  
  # Cleanup
  rm -f "$mock_engram" "$call_count_file"
}

test_end_to_end_with_mock_engram() {
  print_test "End-to-end test with mock Engram"
  
  # Create a mock engram that always succeeds
  local mock_engram="/tmp/mock-engram-e2e-$$"
  cat > "$mock_engram" << 'EOF'
#!/usr/bin/env bash
echo '{"jsonrpc":"2.0","id":1,"result":{"success":true}}'
exit 0
EOF
  chmod +x "$mock_engram"
  
  # Run complete bridge flow
  local output=$(echo "$SAMPLE_FAILED_OUTPUT" | \
    GGA_ENGRAM_BRIDGE_ENABLED=true \
    ENGRAM_MCP_SERVER_PATH="$mock_engram" \
    bash scripts/gga-engram-bridge.sh 2>&1)
  
  assert_contains "$output" "Bridge enabled" "Bridge should be enabled"
  assert_contains "$output" "STATUS=FAILED" "Should parse FAILED status"
  assert_contains "$output" "violations=2" "Should have 2 violations"
  assert_contains "$output" "Saved 2 violations, 0 failed" "Should save all violations"
  assert_contains "$output" "Summary saved successfully" "Should save summary"
  
  # Cleanup
  rm -f "$mock_engram"
}

################################################################################
# Main Test Runner
################################################################################

main() {
  print_header "GGA-Engram Bridge MCP Integration Tests (Task 5)"
  
  echo "Testing MCP client integration functions"
  echo ""
  
  # MCP Integration Tests
  print_header "MCP Connection Tests"
  test_connect_to_engram_not_found
  test_connect_to_engram_found
  
  print_header "MCP Request Format Tests"
  test_save_violation_format
  test_save_summary_format
  
  print_header "Error Handling Tests"
  test_timeout_handling
  test_error_isolation
  
  print_header "End-to-End Tests"
  test_end_to_end_with_mock_engram
  
  # Print summary
  print_header "Test Summary"
  echo ""
  echo "Tests run:    $TESTS_RUN"
  echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
  
  if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
  else
    echo -e "Tests failed: ${GREEN}0${NC}"
    echo ""
    echo -e "${GREEN}✅ All MCP integration tests passed!${NC}"
    echo ""
    echo "Task 5.1 (MCP client integration) is complete."
    echo "Optional property tests (5.2-5.9) are skipped for MVP."
    exit 0
  fi
}

# Run tests
main "$@"
