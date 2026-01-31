# Products P1 Improvements - Deployment Guide

## Overview

This guide covers the deployment of Products P1 Improvements feature, including image management, bulk operations, and CSV import/export functionality.

## Prerequisites

### Environment Variables

Ensure the following environment variables are set:

```bash
# Supabase Configuration (for image storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (optional, falls back to in-memory cache)
REDIS_URL=redis://host:port

# JWT (for authentication)
JWT_SECRET=your-jwt-secret
PIN_SALT=your-pin-salt
```

### NPM Dependencies

Install required packages:

```bash
npm install sharp papaparse fast-check
npm install --save-dev @types/papaparse
```

### Database Migration

Apply the product images migration:

```bash
npx prisma migrate deploy
```

Or manually run:

```sql
-- Add images column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient image queries
CREATE INDEX IF NOT EXISTS idx_products_images ON products USING GIN (images);
```

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (unit, property-based, integration, E2E)
- [ ] TypeScript diagnostics clean (`npx tsc --noEmit`)
- [ ] Build successful (`npm run build`)
- [ ] Environment variables configured
- [ ] Database migration applied
- [ ] Supabase Storage bucket created (`products`)
- [ ] Supabase Storage policies configured (see below)

### Deployment Steps

1. **Backup Database**
   ```bash
   pg_dump -h host -U user -d database > backup_$(date +%Y%m%d).sql
   ```

2. **Deploy Code**
   ```bash
   git push origin main
   # Or deploy via Vercel/your platform
   ```

3. **Verify Deployment**
   - Check health endpoint: `GET /api/health`
   - Test image upload: `POST /api/admin/products/images`
   - Test CSV export: `GET /api/admin/products/export`
   - Test bulk operations: `POST /api/admin/products/bulk`

4. **Monitor Logs**
   - Check for errors in application logs
   - Monitor Supabase Storage usage
   - Monitor database performance

### Post-Deployment

- [ ] Verify all endpoints responding
- [ ] Test image upload/delete workflow
- [ ] Test CSV import/export workflow
- [ ] Test bulk operations workflow
- [ ] Monitor error rates
- [ ] Monitor performance metrics

## Supabase Storage Configuration

### Create Bucket

```sql
-- Create products bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true);
```

### Storage Policies

```sql
-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- Allow public read access
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'products');
```

## Rollback Plan

If issues occur after deployment:

### 1. Rollback Code

```bash
git revert HEAD
git push origin main
```

### 2. Rollback Database (if needed)

```bash
# Restore from backup
psql -h host -U user -d database < backup_YYYYMMDD.sql
```

### 3. Clean Up Images (if needed)

```bash
# Delete all images from Supabase Storage
# Use Supabase Dashboard or API
```

## Monitoring

### Key Metrics

- **Image Upload Success Rate**: Should be >99%
- **CSV Import Success Rate**: Should be >95%
- **Bulk Operation Success Rate**: Should be >99%
- **API Response Times**:
  - Image upload: <3s
  - CSV import (500 rows): <30s
  - Bulk update (100 products): <5s
  - CSV export (1000 products): <10s

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 400 | Invalid request data | Check request format |
| 401 | Unauthorized | Check authentication |
| 404 | Resource not found | Verify resource exists |
| 409 | Duplicate SKU | Use different SKU |
| 413 | Image too large | Reduce image size |
| 500 | Server error | Check logs, contact support |

### Logging

All operations are logged with:
- Request ID (for tracing)
- User ID (for audit)
- Operation type
- Duration
- Success/failure status

Example log query:
```
operation:"csv_import" AND level:"error"
```

## Performance Optimization

### Image Storage

- Images are automatically optimized to WEBP format
- 3 versions generated: original (max 1920x1920), medium (800x800), thumbnail (200x200)
- Quality set to 85 for optimal compression

### Bulk Operations

- Processed in batches of 50 products
- Uses database transactions for atomicity
- Cache invalidated after operations

### CSV Import/Export

- Processed in batches of 50 rows
- Streaming for large exports (>1000 products)
- Validation errors don't stop processing

## Security Considerations

### Authentication

- All admin endpoints require authentication
- JWT tokens validated on every request
- Session management with expiry

### Authorization

- Only admin role can access product management
- Audit trail for all operations
- Tenant isolation enforced

### Input Validation

- Zod schemas for all inputs
- File signature validation for images
- CSV validation before processing

### Rate Limiting

- Implemented at API level
- Prevents abuse and DoS attacks

## Troubleshooting

### Image Upload Fails

**Symptom**: 500 error on image upload

**Possible Causes**:
1. Supabase Storage not configured
2. Invalid SUPABASE_SERVICE_ROLE_KEY
3. Bucket doesn't exist
4. Storage policies not set

**Solution**:
1. Verify environment variables
2. Check Supabase Dashboard
3. Create bucket if missing
4. Apply storage policies

### CSV Import Fails

**Symptom**: All rows skipped or errors

**Possible Causes**:
1. Invalid CSV format
2. Missing required headers
3. Invalid data types
4. Duplicate SKUs

**Solution**:
1. Download template CSV
2. Verify headers match template
3. Check data types (price must be number)
4. Ensure SKUs are unique

### Bulk Operations Fail

**Symptom**: Partial updates or no updates

**Possible Causes**:
1. Invalid product IDs
2. Database timeout
3. Transaction rollback

**Solution**:
1. Verify product IDs exist
2. Reduce batch size
3. Check database logs

## Support

For issues or questions:
1. Check application logs
2. Review error messages
3. Consult this guide
4. Contact development team

## Changelog

### Version 1.0.0 (Initial Release)

**Features**:
- Image management (upload, delete, reorder)
- Bulk operations (activate, deactivate, update, delete)
- CSV import/export
- Property-based testing
- Integration testing

**Performance**:
- Image upload: <3s
- CSV import (500 rows): <30s
- Bulk update (100 products): <5s
- CSV export (1000 products): <10s

**Testing**:
- 48 property-based tests
- 12 integration tests
- 100% coverage for critical paths
