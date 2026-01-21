# Tasks: Admin Panel Location ID Fix

## Task List

- [ ] 1. Create location constants file
  - [ ] 1.1 Create `src/core/config/location.ts`
  - [ ] 1.2 Define `DEFAULT_LOCATION_ID` constant
  - [ ] 1.3 Define `DEFAULT_TENANT_ID` constant
  - [ ] 1.4 Export constants

- [ ] 2. Update seed file
  - [ ] 2.1 Import constants from `location.ts`
  - [ ] 2.2 Replace `TENANT_ID` local constant with import
  - [ ] 2.3 Replace `uuid()` for location with `DEFAULT_LOCATION_ID`
  - [ ] 2.4 Verify all references use the constant

- [ ] 3. Update tables API endpoint
  - [ ] 3.1 Import constants from `location.ts`
  - [ ] 3.2 Replace hardcoded defaults with constants
  - [ ] 3.3 Update environment variable fallbacks

- [ ] 4. Update zones API endpoint
  - [ ] 4.1 Import constants from `location.ts`
  - [ ] 4.2 Replace hardcoded defaults with constants
  - [ ] 4.3 Update environment variable fallbacks

- [ ] 5. Create migration script (optional)
  - [ ] 5.1 Create `scripts/fix-location-ids.ts`
  - [ ] 5.2 Implement location ID update logic
  - [ ] 5.3 Add transaction safety
  - [ ] 5.4 Add logging and verification

- [ ] 6. Reset and re-seed database
  - [ ] 6.1 Run `npm run db:reset`
  - [ ] 6.2 Run `npm run db:seed`
  - [ ] 6.3 Verify location_id in database

- [ ] 7. Test API endpoints
  - [ ] 7.1 Test GET `/api/admin/tables` returns 23 tables
  - [ ] 7.2 Test GET `/api/admin/zones` returns 4 zones
  - [ ] 7.3 Verify zone table counts are correct

- [ ] 8. Test admin panel
  - [ ] 8.1 Open `/admin/mesas` page
  - [ ] 8.2 Verify all 23 tables display
  - [ ] 8.3 Verify zone filtering works
  - [ ] 8.4 Verify zone summary shows correct counts

- [ ] 9. Update documentation
  - [ ] 9.1 Document location constants in MASTER.md
  - [ ] 9.2 Add to "FIXES RECIENTES" section
  - [ ] 9.3 Update any relevant architecture docs

## Task Details

### Task 1: Create location constants file

Create a centralized location for location and tenant constants.

**File:** `src/core/config/location.ts`

```typescript
/**
 * Location and Tenant Configuration
 * 
 * Centralized constants for default location and tenant IDs.
 * These must match the values used in seed data.
 */

export const DEFAULT_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const DEFAULT_LOCATION_ID = 'loc-00000000-0000-0000-0000-000000000001';

/**
 * Get tenant ID from environment or use default
 */
export function getTenantId(): string {
  return process.env.TENANT_ID || DEFAULT_TENANT_ID;
}

/**
 * Get location ID from environment or use default
 */
export function getLocationId(): string {
  return process.env.LOCATION_ID || DEFAULT_LOCATION_ID;
}
```

### Task 2: Update seed file

Update the seed file to use the fixed location ID.

**File:** `prisma/seed.ts`

**Changes:**
1. Import constants at top of file
2. Replace local `TENANT_ID` constant
3. Replace `const locationId = uuid()` with `const locationId = DEFAULT_LOCATION_ID`

### Task 3-4: Update API endpoints

Update both tables and zones API endpoints to use the constants.

**Files:**
- `src/app/api/admin/tables/route.ts`
- `src/app/api/admin/zones/route.ts`

**Changes:**
```typescript
// Replace these lines:
const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = process.env.LOCATION_ID || 'default';

// With:
import { getTenantId, getLocationId } from '@/src/core/config/location';

const TENANT_ID = getTenantId();
const LOCATION_ID = getLocationId();
```

### Task 6: Reset and re-seed database

```bash
# Reset database (WARNING: Deletes all data)
npm run db:reset

# Re-run seed with fixed location ID
npm run db:seed
```

### Task 7: Test API endpoints

```bash
# Test tables endpoint
curl http://localhost:3000/api/admin/tables | jq '.data | length'
# Expected: 23

# Test zones endpoint
curl http://localhost:3000/api/admin/zones | jq '.data'
# Expected: 4 zones with correct table counts
```

### Task 8: Test admin panel

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000/admin`
3. Login with PIN 1234
4. Navigate to "Mesas" section
5. Verify:
   - All 23 tables display
   - Zone summary shows: Salón (10), Terraza (6), Barra (4), VIP (3)
   - Zone filtering works
   - Table creation/editing works

## Success Criteria

- ✅ All 23 tables visible in admin panel
- ✅ All 4 zones visible with correct counts
- ✅ Zone filtering works correctly
- ✅ No console errors
- ✅ API endpoints return correct data
- ✅ Database has consistent location_id values

## Rollback Procedure

If issues occur:

```bash
# 1. Revert code changes
git checkout HEAD -- src/core/config/location.ts
git checkout HEAD -- prisma/seed.ts
git checkout HEAD -- src/app/api/admin/tables/route.ts
git checkout HEAD -- src/app/api/admin/zones/route.ts

# 2. Reset database
npm run db:reset

# 3. Re-seed with original code
npm run db:seed
```
