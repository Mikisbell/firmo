# Design: Admin Panel Location ID Fix

## Overview

Fix the location_id mismatch between seed data and API endpoints by using a consistent, fixed location ID throughout the system.

## Design Decision

**Chosen Approach:** Fixed UUID Constant

We will use a fixed UUID constant for the default location across the entire system. This provides:
- Predictable, consistent location_id
- No additional database queries
- Simple to implement and maintain
- Compatible with existing single-location architecture

## Implementation

### 1. Constants Definition

Create a shared constant for the default location ID:

```typescript
// src/core/config/location.ts
export const DEFAULT_LOCATION_ID = 'loc-00000000-0000-0000-0000-000000000001';
export const DEFAULT_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

### 2. Seed File Updates

Update `prisma/seed.ts` to use the fixed location ID:

```typescript
import { DEFAULT_LOCATION_ID, DEFAULT_TENANT_ID } from '../src/core/config/location';

// Replace:
const locationId = uuid();

// With:
const locationId = DEFAULT_LOCATION_ID;

// And use DEFAULT_TENANT_ID instead of local TENANT_ID constant
```

### 3. API Endpoint Updates

Update all admin API endpoints to use the constant:

**Files to update:**
- `src/app/api/admin/tables/route.ts`
- `src/app/api/admin/zones/route.ts`
- Any other endpoints filtering by location_id

```typescript
import { DEFAULT_LOCATION_ID, DEFAULT_TENANT_ID } from '@/src/core/config/location';

// Replace:
const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = process.env.LOCATION_ID || 'default';

// With:
const TENANT_ID = process.env.TENANT_ID || DEFAULT_TENANT_ID;
const LOCATION_ID = process.env.LOCATION_ID || DEFAULT_LOCATION_ID;
```

### 4. Database Migration (Optional)

If database already has data with wrong location_id, provide a migration script:

```typescript
// scripts/fix-location-ids.ts
import { PrismaClient } from '@prisma/client';
import { DEFAULT_LOCATION_ID, DEFAULT_TENANT_ID } from '../src/core/config/location';

const prisma = new PrismaClient();

async function main() {
  // Get the current location
  const location = await prisma.locations.findFirst({
    where: { tenant_id: DEFAULT_TENANT_ID }
  });
  
  if (!location) {
    console.log('No location found');
    return;
  }
  
  console.log(`Current location ID: ${location.id}`);
  console.log(`Target location ID: ${DEFAULT_LOCATION_ID}`);
  
  if (location.id === DEFAULT_LOCATION_ID) {
    console.log('✅ Location ID already correct');
    return;
  }
  
  // Update location ID
  await prisma.$transaction(async (tx) => {
    // Update zones
    await tx.zones.updateMany({
      where: { location_id: location.id },
      data: { location_id: DEFAULT_LOCATION_ID }
    });
    
    // Update tables
    await tx.tables.updateMany({
      where: { location_id: location.id },
      data: { location_id: DEFAULT_LOCATION_ID }
    });
    
    // Update location itself
    await tx.locations.update({
      where: { id: location.id },
      data: { id: DEFAULT_LOCATION_ID }
    });
  });
  
  console.log('✅ Location IDs updated successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Testing

### Unit Tests

No unit tests needed - this is a configuration fix.

### Integration Tests

1. **Seed Test**: Run seed script and verify location_id is correct
2. **API Test**: Query `/api/admin/tables` and verify tables are returned
3. **Admin Panel Test**: Open admin panel and verify tables/zones display

### Manual Verification

```bash
# 1. Re-run seed
npm run db:seed

# 2. Check database
npx prisma studio
# Verify locations.id = 'loc-00000000-0000-0000-0000-000000000001'
# Verify zones.location_id matches
# Verify tables.location_id matches

# 3. Test API
curl http://localhost:3000/api/admin/tables
# Should return 23 tables

# 4. Test Admin Panel
# Open http://localhost:3000/admin/mesas
# Should see all tables
```

## Rollback Plan

If issues occur:
1. Revert code changes
2. Run `npm run db:reset` to restore database
3. Re-run seed with original code

## Future Considerations

### Multi-Location Support

When adding multi-location support:
1. Add location selector to admin panel
2. Pass selected location_id to API endpoints
3. Update API endpoints to use dynamic location_id from request
4. Keep DEFAULT_LOCATION_ID as fallback

### Environment Variables

Support for environment-based configuration:
```bash
# .env
TENANT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
LOCATION_ID=loc-00000000-0000-0000-0000-000000000001
```

## Files to Modify

1. **New file**: `src/core/config/location.ts` - Constants definition
2. **Update**: `prisma/seed.ts` - Use fixed location ID
3. **Update**: `src/app/api/admin/tables/route.ts` - Import and use constant
4. **Update**: `src/app/api/admin/zones/route.ts` - Import and use constant
5. **New file**: `scripts/fix-location-ids.ts` - Migration script (optional)

## Estimated Effort

- Implementation: 30 minutes
- Testing: 15 minutes
- Total: 45 minutes

## Risk Assessment

**Risk Level:** LOW

- Simple configuration change
- No logic changes
- Easy to verify
- Easy to rollback
