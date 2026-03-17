#!/usr/bin/env bash

# Comprehensive test suite for GGA parser

export GGA_ENGRAM_BRIDGE_ENABLED="true"
export GGA_BRIDGE_LOG_LEVEL="info"

echo "=========================================="
echo "GGA Parser Comprehensive Test Suite"
echo "=========================================="
echo ""

# Test 1: PASSED status
echo "Test 1: PASSED status (no violations)"
echo "--------------------------------------"
cat << 'EOF' | bash scripts/gga-engram-bridge.sh
STATUS: PASSED

No violations found.
EOF
echo ""

# Test 2: FAILED with single violation
echo "Test 2: FAILED with single violation"
echo "--------------------------------------"
cat << 'EOF' | bash scripts/gga-engram-bridge.sh
STATUS: FAILED

Violations found:

1. **src/test.ts:10** - Test Rule
   - Issue: This is a test issue
   - Fix: This is a test fix
EOF
echo ""

# Test 3: FAILED with multiple violations
echo "Test 3: FAILED with multiple violations"
echo "--------------------------------------"
cat << 'EOF' | bash scripts/gga-engram-bridge.sh
STATUS: FAILED

Violations found:

1. **src/components/Button.tsx:3** - TypeScript Rule
   - Issue: Using any type for props
   - Fix: Define proper interface for ButtonProps

2. **src/api/orders.ts:45** - Money Rule
   - Issue: Money value should be stored as integer cents, not float
   - Fix: Change price to price_cents and store as integer

3. **src/api/auth.ts:23** - Security Rule
   - Issue: tenant_id must come from JWT, never from request body
   - Fix: Use authResult.user.tenantId instead of req.body.tenant_id
EOF
echo ""

# Test 4: Empty output
echo "Test 4: Empty output"
echo "--------------------------------------"
echo "" | bash scripts/gga-engram-bridge.sh
echo ""

# Test 5: Malformed output (no STATUS)
echo "Test 5: Malformed output (no STATUS field)"
echo "--------------------------------------"
cat << 'EOF' | bash scripts/gga-engram-bridge.sh
Some random output
without STATUS field
EOF
echo ""

# Test 6: Bridge disabled
echo "Test 6: Bridge disabled"
echo "--------------------------------------"
export GGA_ENGRAM_BRIDGE_ENABLED="false"
cat << 'EOF' | bash scripts/gga-engram-bridge.sh
STATUS: FAILED

Violations found:

1. **src/test.ts:1** - Test
   - Issue: Test
   - Fix: Test
EOF
export GGA_ENGRAM_BRIDGE_ENABLED="true"
echo ""

# Test 7: Special characters in messages
echo "Test 7: Special characters in messages"
echo "--------------------------------------"
cat << 'EOF' | bash scripts/gga-engram-bridge.sh
STATUS: FAILED

Violations found:

1. **src/utils/format.ts:15** - String Rule
   - Issue: Using backticks and quotes: `value` "test" 'single'
   - Fix: Use proper escaping for special chars: \` \" \'
EOF
echo ""

echo "=========================================="
echo "All tests completed"
echo "=========================================="
