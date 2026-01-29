# User Guide: CSV Import/Export

## Overview

CSV import/export allows you to manage products in bulk using spreadsheet software like Excel, Google Sheets, or LibreOffice Calc.

## Features

- Export all products to CSV
- Import products from CSV (create new or update existing)
- Download CSV template
- Validation and error reporting
- Batch processing for large files

## CSV Export

### Exporting Products

1. Navigate to **Admin Panel** → **Products**
2. (Optional) Apply filters to export specific products:
   - Category filter
   - Station filter
   - Active/Inactive filter
3. Click **Export CSV** button
4. File downloads automatically as `products_export_YYYYMMDD.csv`

### Export Format

The exported CSV contains the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| sku | Product SKU (unique identifier) | POLLO-001 |
| name | Product name | Pollo a la Brasa |
| short_name | Short name (optional) | Pollo |
| price | Price in centavos (integer) | 3500 |
| category | Product category | POLLOS |
| station | Kitchen station | PARRILLA |
| type | Product type | SIMPLE |
| is_active | Active status | true |

### Export Use Cases

- **Backup**: Regular exports for data backup
- **Analysis**: Import into Excel for analysis
- **Migration**: Move products to another system
- **Bulk Edit**: Edit multiple products in spreadsheet

## CSV Import

### Downloading Template

1. Navigate to **Admin Panel** → **Products**
2. Click **Download Template** button
3. Template file downloads as `products_template.csv`
4. Open in spreadsheet software

The template includes:
- Header row with all required columns
- Example rows showing correct format
- Comments explaining each field

### Preparing CSV File

#### Required Columns

All columns must be present (even if empty):
- `sku` (required)
- `name` (required)
- `short_name` (optional)
- `price` (required)
- `category` (required)
- `station` (required)
- `type` (required)
- `is_active` (required)

#### Valid Values

**Category** (must be one of):
- POLLOS
- PARRILLAS
- BEBIDAS
- EXTRAS
- POSTRES
- COMBOS
- GUARNICIONES

**Station** (must be one of):
- PARRILLA
- COCINA
- BAR
- HORNO
- POSTRES
- EMPAQUE
- FRIOS

**Type** (must be one of):
- SIMPLE
- COMBO
- VARIABLE

**is_active** (must be):
- true
- false

**Price**:
- Integer (centavos)
- Example: 3500 = 35.00 soles
- Must be positive number

### Importing Products

1. Navigate to **Admin Panel** → **Products**
2. Click **Import CSV** button
3. Select your CSV file
4. Wait for validation
5. Review preview:
   - Valid rows (green)
   - Invalid rows (red with error message)
   - Summary (total, valid, invalid)
6. Click **Confirm Import** to proceed
7. Wait for import to complete
8. Review results:
   - Created count
   - Updated count
   - Skipped count
   - Error details

### Import Behavior

**Upsert Logic**:
- If SKU exists: Update existing product
- If SKU is new: Create new product

**Validation**:
- Invalid rows are skipped
- Valid rows are processed
- Import continues even if some rows fail

**Batch Processing**:
- Processed in batches of 50 rows
- Large files may take several minutes

## CSV Format Examples

### Example 1: Simple Product

```csv
sku,name,short_name,price,category,station,type,is_active
POLLO-001,Pollo a la Brasa,Pollo,3500,POLLOS,PARRILLA,SIMPLE,true
```

### Example 2: Combo Product

```csv
sku,name,short_name,price,category,station,type,is_active
COMBO-001,Combo Familiar,,8500,COMBOS,PARRILLA,COMBO,true
```

### Example 3: Beverage

```csv
sku,name,short_name,price,category,station,type,is_active
BEB-001,Inca Kola 1.5L,Inca Kola,500,BEBIDAS,BAR,SIMPLE,true
```

### Example 4: Multiple Products

```csv
sku,name,short_name,price,category,station,type,is_active
POLLO-001,Pollo a la Brasa,Pollo,3500,POLLOS,PARRILLA,SIMPLE,true
POLLO-002,1/4 Pollo,1/4,1200,POLLOS,PARRILLA,SIMPLE,true
BEB-001,Inca Kola 1.5L,Inca Kola,500,BEBIDAS,BAR,SIMPLE,true
EXTRA-001,Papas Fritas,Papas,800,EXTRAS,COCINA,SIMPLE,true
```

## Best Practices

### Before Import

1. **Download Template**: Always start with the template
2. **Backup**: Export current products before import
3. **Test Small**: Test with 5-10 products first
4. **Validate Data**: Check all values are correct
5. **Unique SKUs**: Ensure SKUs are unique

### During Import

1. **Review Preview**: Check validation results
2. **Fix Errors**: Correct invalid rows before import
3. **Monitor Progress**: Wait for completion message
4. **Don't Navigate**: Stay on page during import

### After Import

1. **Verify Results**: Check created/updated counts
2. **Review Products**: Spot-check imported products
3. **Check Errors**: Review any skipped rows
4. **Test Orders**: Verify products work in POS

## Common Errors

### Error: "Missing required headers"

**Cause**: CSV file doesn't have all required columns

**Solution**:
1. Download template
2. Copy your data to template
3. Ensure all columns present

### Error: "Duplicate SKU"

**Cause**: Same SKU appears multiple times in CSV

**Solution**:
1. Find duplicate SKUs
2. Remove or rename duplicates
3. Ensure each SKU is unique

### Error: "Invalid category"

**Cause**: Category value not in allowed list

**Solution**:
1. Check category value
2. Use one of: POLLOS, PARRILLAS, BEBIDAS, EXTRAS, POSTRES, COMBOS, GUARNICIONES
3. Fix typos and case (must be uppercase)

### Error: "Invalid station"

**Cause**: Station value not in allowed list

**Solution**:
1. Check station value
2. Use one of: PARRILLA, COCINA, BAR, HORNO, POSTRES, EMPAQUE, FRIOS
3. Fix typos and case (must be uppercase)

### Error: "Price must be a positive number"

**Cause**: Price is not a valid number or is negative

**Solution**:
1. Check price value
2. Use integer (centavos)
3. Example: 3500 for 35.00 soles
4. Remove currency symbols or decimals

### Error: "SKU is required"

**Cause**: SKU column is empty

**Solution**:
1. Fill in SKU for all products
2. Use unique identifiers
3. Example: POLLO-001, BEB-001

## Performance

### Import Speed

- 50 rows: ~1-2 seconds
- 100 rows: ~3-5 seconds
- 500 rows: ~15-30 seconds
- 1000 rows: ~30-60 seconds

### Export Speed

- 100 products: ~1 second
- 500 products: ~3 seconds
- 1000 products: ~5-10 seconds
- 5000 products: ~30-60 seconds

### Limits

- Maximum file size: 10 MB
- Recommended maximum rows: 5000
- For larger imports, split into multiple files

## Troubleshooting

### Import Hangs

**Problem**: Import doesn't complete

**Solutions**:
1. Check file size (<10 MB)
2. Reduce number of rows
3. Check internet connection
4. Refresh page and try again

### Export Empty

**Problem**: Export file has no data

**Solutions**:
1. Check if products exist
2. Clear filters
3. Verify admin permissions
4. Try again

### Encoding Issues

**Problem**: Special characters display incorrectly

**Solutions**:
1. Save CSV as UTF-8 encoding
2. Use Excel: Save As → CSV UTF-8
3. Use Google Sheets: Download → CSV
4. Avoid special characters in SKUs

### Excel Formula Issues

**Problem**: Excel converts SKUs to numbers or dates

**Solutions**:
1. Format SKU column as Text before entering data
2. Prefix SKUs with apostrophe: '001
3. Use Google Sheets instead
4. Import as Text in Excel

## Advanced Usage

### Bulk Price Update

```
1. Export current products
2. Open in Excel
3. Update price column
4. Save as CSV
5. Import updated CSV
6. Existing products updated with new prices
```

### Category Reorganization

```
1. Export products by category
2. Update category column
3. Save as CSV
4. Import updated CSV
5. Products moved to new categories
```

### Seasonal Menu

```
1. Export all products
2. Set is_active to false for off-season items
3. Set is_active to true for in-season items
4. Save as CSV
5. Import updated CSV
6. Menu updated for season
```

## FAQ

**Q: Can I import images via CSV?**  
A: No, images must be uploaded individually through the UI.

**Q: What happens to existing products during import?**  
A: Products with matching SKUs are updated. New SKUs create new products.

**Q: Can I delete products via CSV?**  
A: No, use bulk delete in UI or set is_active to false.

**Q: Can I import products for multiple tenants?**  
A: No, imports are tenant-specific. Log in to each tenant separately.

**Q: What if import fails halfway?**  
A: Completed batches are saved. Failed batches are skipped. You can retry with failed rows.

**Q: Can I schedule automatic imports?**  
A: No, imports must be triggered manually through the UI.

**Q: How do I handle decimal prices?**  
A: Convert to centavos (multiply by 100). Example: 35.50 → 3550

**Q: Can I import in other formats (Excel, JSON)?**  
A: No, only CSV format is supported.

## Tips

- **Use Google Sheets**: Better CSV handling than Excel
- **Test First**: Always test with small file first
- **Keep Backup**: Export before every import
- **Document Changes**: Keep notes on what you imported
- **Regular Exports**: Export weekly for backup
- **Version Control**: Name exports with date (products_20260129.csv)
