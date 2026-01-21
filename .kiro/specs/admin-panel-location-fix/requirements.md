# Admin Panel Location ID Mismatch Fix

## Problem Statement

The admin panel is not displaying tables and zones because of a location_id mismatch between the seed data and API endpoints.

**Root Cause:**
- Seed file (`prisma/seed.ts`) creates a location with a random UUID and uses that for zones/tables
- API endpoints (`/api/admin/tables`, `/api/admin/zones`) filter by hardcoded `LOCATION_ID = 'default'`
- No records match because the location_ids don't align

**Impact:** CRITICAL - Admin panel cannot display or manage tables and zones

## Requirements

### 1. Fix Location ID Consistency

**1.1** Seed file must use a consistent, predictable location_id
- Use a fixed UUID or the string 'default' for the default location
- Ensure all zones and tables reference this consistent location_id

**1.2** API endpoints must query using the correct location_id
- Either use the same fixed UUID from seed
- Or query for the first/default location dynamically
- Remove hardcoded 'default' string if not matching seed data

**1.3** Environment variable support
- Support `LOCATION_ID` environment variable for multi-location deployments
- Default to the fixed location_id used in seed if not set

### 2. Verification

**2.1** Tables must display in admin panel after fix
- Verify all 23 tables from seed data appear
- Verify zone filtering works correctly

**2.2** Zones must display with correct table counts
- Verify all 4 zones appear
- Verify table counts match seed data (10, 6, 4, 3)

## Acceptance Criteria

- [ ] Seed file uses consistent location_id
- [ ] API endpoints query correct location_id
- [ ] Admin panel displays all tables (23 total)
- [ ] Admin panel displays all zones (4 total) with correct counts
- [ ] No breaking changes to existing functionality
- [ ] Environment variable support for LOCATION_ID

## Solution Approach

**Option A: Use Fixed UUID in Seed** (Recommended)
- Define `DEFAULT_LOCATION_ID` constant in seed file
- Use this constant instead of `uuid()` for location creation
- Update API endpoints to use same constant

**Option B: Dynamic Location Query**
- API endpoints query for first location instead of hardcoding
- More flexible but adds query overhead
- Better for multi-location support

**Recommendation:** Use Option A for simplicity and performance. The system currently assumes single-location operation.
