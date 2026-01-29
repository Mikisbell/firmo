# User Guide: Bulk Operations

## Overview

Bulk operations allow you to update multiple products at once, saving time and effort when managing large product catalogs.

## Available Operations

- **Activate**: Enable multiple products for sale
- **Deactivate**: Disable multiple products from sale
- **Change Category**: Update category for multiple products
- **Change Station**: Update kitchen station for multiple products
- **Delete**: Soft delete multiple products (mark as inactive)

## Using Bulk Operations

### Step 1: Select Products

1. Navigate to **Admin Panel** → **Products**
2. Use checkboxes to select products:
   - Click individual checkboxes to select specific products
   - Click **Select All** to select all products on current page
   - Use filters to narrow down products before selecting

### Step 2: Choose Operation

Once products are selected, the **Bulk Actions** toolbar appears at the top.

Click the desired operation button:
- **Activate** (green button)
- **Deactivate** (yellow button)
- **Change Category** (blue button)
- **Change Station** (blue button)
- **Delete** (red button)

### Step 3: Confirm Action

For operations requiring input (Category, Station):
1. A modal dialog appears
2. Select the new value from dropdown
3. Click **Confirm**

For destructive operations (Delete):
1. A confirmation dialog appears
2. Review the number of products affected
3. Click **Confirm** to proceed or **Cancel** to abort

### Step 4: Review Results

After operation completes:
- Success toast notification shows number of products updated
- Product list refreshes automatically
- Any errors are displayed in error toast

## Operation Details

### Activate Products

**Purpose**: Enable products for sale

**Use Cases**:
- Seasonal products coming back in stock
- New products ready to launch
- Products after quality check

**Steps**:
1. Select inactive products
2. Click **Activate**
3. Confirm action
4. Products become available for sale

**Result**: `is_active` set to `true`

### Deactivate Products

**Purpose**: Temporarily disable products from sale

**Use Cases**:
- Out of stock items
- Seasonal products going out of season
- Products under review

**Steps**:
1. Select active products
2. Click **Deactivate**
3. Confirm action
4. Products become unavailable for sale

**Result**: `is_active` set to `false`

**Note**: Deactivated products remain in database and can be reactivated later.

### Change Category

**Purpose**: Move products to different category

**Use Cases**:
- Reorganizing product catalog
- Fixing miscategorized products
- Creating new category structure

**Steps**:
1. Select products to recategorize
2. Click **Change Category**
3. Select new category from dropdown:
   - POLLOS
   - PARRILLAS
   - BEBIDAS
   - EXTRAS
   - POSTRES
   - COMBOS
   - GUARNICIONES
4. Click **Confirm**
5. Products moved to new category

**Result**: `category` updated to selected value

### Change Station

**Purpose**: Reassign products to different kitchen station

**Use Cases**:
- Kitchen reorganization
- Load balancing between stations
- New station assignments

**Steps**:
1. Select products to reassign
2. Click **Change Station**
3. Select new station from dropdown:
   - PARRILLA (Grill)
   - COCINA (Kitchen)
   - BAR (Bar)
   - HORNO (Oven)
   - POSTRES (Desserts)
   - EMPAQUE (Packaging)
   - FRIOS (Cold station)
4. Click **Confirm**
5. Products assigned to new station

**Result**: `station` updated to selected value

### Delete Products

**Purpose**: Remove products from active catalog (soft delete)

**Use Cases**:
- Discontinued products
- Duplicate entries
- Test products

**Steps**:
1. Select products to delete
2. Click **Delete**
3. Review warning message
4. Click **Confirm** to proceed
5. Products marked as inactive

**Result**: `is_active` set to `false`

**Important**: This is a soft delete. Products remain in database for audit purposes but are hidden from active catalog.

## Selection Tips

### Using Filters

Combine filters with bulk operations for efficient management:

```
Example 1: Deactivate all beverages
1. Filter by Category: BEBIDAS
2. Click "Select All"
3. Click "Deactivate"
4. Confirm

Example 2: Change station for all grill items
1. Filter by Station: PARRILLA
2. Filter by Category: POLLOS
3. Click "Select All"
4. Click "Change Station"
5. Select new station
6. Confirm
```

### Keyboard Shortcuts

- **Ctrl+A**: Select all products on current page
- **Escape**: Deselect all products
- **Enter**: Confirm dialog (when dialog is open)

### Pagination

- Selections are per-page only
- Changing pages clears current selection
- Use filters to get all desired products on one page

## Best Practices

### Before Bulk Operations

1. **Filter First**: Use filters to narrow down products
2. **Review Selection**: Double-check selected products
3. **Test Small**: Try with 2-3 products first
4. **Backup**: Export CSV before major changes

### During Bulk Operations

1. **Wait for Completion**: Don't navigate away during operation
2. **Monitor Progress**: Watch for success/error messages
3. **Check Results**: Verify changes after operation

### After Bulk Operations

1. **Verify Changes**: Review updated products
2. **Check Catalog Version**: Ensure terminals sync new data
3. **Monitor Orders**: Watch for any issues with updated products

## Performance

### Batch Processing

Bulk operations are processed in batches of 50 products:
- 50 products: ~1-2 seconds
- 100 products: ~3-5 seconds
- 500 products: ~15-25 seconds

### Limits

- Maximum 1000 products per operation
- For larger operations, split into multiple batches
- Operations are atomic (all succeed or all fail)

## Error Handling

### Partial Failures

If some products fail to update:
1. Success toast shows number of successful updates
2. Error toast shows number of failures
3. Failed products remain unchanged
4. Successful updates are committed

### Common Errors

**Error**: "Some products not found"  
**Cause**: Products were deleted by another user  
**Solution**: Refresh page and try again

**Error**: "Operation timeout"  
**Cause**: Too many products selected  
**Solution**: Reduce selection size and try again

**Error**: "Unauthorized"  
**Cause**: Session expired  
**Solution**: Log in again

## Examples

### Example 1: Seasonal Menu Update

```
Scenario: Activate summer drinks, deactivate winter drinks

Steps:
1. Filter by Category: BEBIDAS
2. Filter by Name: "Caliente" (hot drinks)
3. Select all hot drinks
4. Click "Deactivate"
5. Confirm
6. Clear filters
7. Filter by Name: "Helado" (cold drinks)
8. Select all cold drinks
9. Click "Activate"
10. Confirm
```

### Example 2: Kitchen Reorganization

```
Scenario: Move desserts from COCINA to POSTRES station

Steps:
1. Filter by Category: POSTRES
2. Filter by Station: COCINA
3. Select all desserts
4. Click "Change Station"
5. Select "POSTRES"
6. Confirm
```

### Example 3: Price Category Cleanup

```
Scenario: Recategorize combo meals

Steps:
1. Filter by Type: COMBO
2. Filter by Category: POLLOS
3. Select all combos
4. Click "Change Category"
5. Select "COMBOS"
6. Confirm
```

## Troubleshooting

### Selection Not Working

**Problem**: Cannot select products

**Solutions**:
1. Refresh page
2. Clear browser cache
3. Check if products are filtered out
4. Verify admin permissions

### Operation Not Completing

**Problem**: Operation hangs or times out

**Solutions**:
1. Reduce number of selected products
2. Check internet connection
3. Refresh page and try again
4. Contact support if persists

### Changes Not Visible

**Problem**: Updates not showing in product list

**Solutions**:
1. Refresh page
2. Clear filters
3. Check if operation succeeded (toast message)
4. Verify catalog version incremented

## FAQ

**Q: Can I undo a bulk operation?**  
A: No, bulk operations cannot be undone. Export CSV before major changes as backup.

**Q: What happens if I close the browser during operation?**  
A: The operation continues on the server. Refresh page to see results.

**Q: Can I bulk update prices?**  
A: No, price updates must be done individually or via CSV import.

**Q: Can I bulk upload images?**  
A: No, images must be uploaded individually per product.

**Q: How do I know if operation succeeded?**  
A: Success toast notification shows number of products updated. Check product list to verify.

**Q: Can I select products across multiple pages?**  
A: No, selections are per-page only. Use filters to get all desired products on one page.

**Q: What's the maximum number of products I can update at once?**  
A: Recommended maximum is 1000 products. For larger operations, split into batches.

## Tips

- **Export First**: Always export CSV before bulk operations as backup
- **Test Small**: Try with 2-3 products before bulk operation
- **Use Filters**: Combine filters for precise selection
- **Monitor Catalog**: Check catalog version after operations
- **Audit Trail**: All operations are logged for audit purposes
