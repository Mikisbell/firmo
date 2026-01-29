# User Guide: Image Management

## Overview

The image management feature allows you to upload, organize, and manage product images in the admin panel.

## Features

- Upload up to 5 images per product
- Automatic image optimization (WEBP format)
- Multiple image sizes (original, medium, thumbnail)
- Drag-and-drop interface
- Image reordering
- Primary image selection

## Uploading Images

### Method 1: During Product Creation

1. Navigate to **Admin Panel** → **Products** → **New Product**
2. Fill in product details (SKU, name, price, etc.)
3. Scroll to **Images** section
4. Click **Upload Images** or drag files into the drop zone
5. Select up to 5 images (JPEG, PNG, WEBP)
6. Wait for upload to complete
7. Click **Save** to create product with images

### Method 2: Adding to Existing Product

1. Navigate to **Admin Panel** → **Products**
2. Click **Edit** on the product you want to update
3. Scroll to **Images** section
4. Click **Upload Images** or drag files into the drop zone
5. Select images to upload
6. Wait for upload to complete
7. Click **Save** to update product

## Image Requirements

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WEBP (.webp)

### Size Limits
- Maximum file size: 5 MB per image
- Recommended dimensions: 1920x1920 pixels or smaller
- Minimum dimensions: 200x200 pixels

### Optimization
Images are automatically optimized:
- Converted to WEBP format for better compression
- 3 versions generated:
  - **Original**: Max 1920x1920px (for product detail view)
  - **Medium**: 800x800px (for product list view)
  - **Thumbnail**: 200x200px (for quick previews)
- Quality: 85% (optimal balance between size and quality)

## Managing Images

### Reordering Images

The first image is always the **primary image** (shown in product lists).

To reorder images:
1. Edit the product
2. In the **Images** section, use the **↑** and **↓** buttons
3. Move images up or down
4. The first image becomes the primary image
5. Click **Save** to apply changes

### Deleting Images

To delete an image:
1. Edit the product
2. In the **Images** section, click the **🗑️** (trash) icon on the image
3. Confirm deletion
4. Click **Save** to apply changes

**Note**: Deleted images are permanently removed from storage and cannot be recovered.

### Viewing Images

Images are displayed in:
- **Product List**: Primary image thumbnail (200x200px)
- **Product Detail**: All images in gallery (800x800px)
- **Product Edit Form**: All images with management controls

## Best Practices

### Image Quality
- Use high-resolution images (at least 1000x1000px)
- Ensure good lighting and clear product visibility
- Use consistent background (white or transparent recommended)
- Avoid watermarks or text overlays

### Image Organization
- Set the best product view as the primary image (first position)
- Show different angles in subsequent images
- Include detail shots for important features
- Maintain consistent style across all product images

### Performance
- Upload images one at a time for better reliability
- Wait for each upload to complete before uploading the next
- Use WEBP format when possible (smaller file size)
- Compress images before upload if they're very large

## Troubleshooting

### Upload Fails

**Problem**: Image upload fails with error message

**Solutions**:
1. Check file size (must be <5 MB)
2. Verify file format (JPEG, PNG, or WEBP only)
3. Ensure stable internet connection
4. Try uploading one image at a time
5. Refresh page and try again

### Image Not Displaying

**Problem**: Image uploaded but not showing

**Solutions**:
1. Refresh the page
2. Clear browser cache
3. Check if image was saved (click Save button)
4. Verify image URL in browser console

### Slow Upload

**Problem**: Image upload takes too long

**Solutions**:
1. Reduce image file size before upload
2. Use WEBP format instead of PNG
3. Compress images using online tools
4. Check internet connection speed

### Image Limit Reached

**Problem**: Cannot upload more images

**Solution**: Each product can have maximum 5 images. Delete an existing image before uploading a new one.

## Examples

### Example 1: Adding Images to New Product

```
1. Click "New Product"
2. Enter:
   - SKU: POLLO-001
   - Name: Pollo a la Brasa
   - Price: 3500 (35.00 soles)
   - Category: POLLOS
   - Station: PARRILLA
3. Upload images:
   - pollo-front.jpg (primary)
   - pollo-side.jpg
   - pollo-detail.jpg
4. Click "Save"
```

### Example 2: Reordering Images

```
1. Edit product "Pollo a la Brasa"
2. Current order:
   [1] pollo-side.jpg
   [2] pollo-front.jpg
   [3] pollo-detail.jpg
3. Click ↓ on pollo-side.jpg
4. New order:
   [1] pollo-front.jpg (now primary)
   [2] pollo-side.jpg
   [3] pollo-detail.jpg
5. Click "Save"
```

### Example 3: Replacing an Image

```
1. Edit product "Pollo a la Brasa"
2. Click 🗑️ on old image
3. Confirm deletion
4. Click "Upload Images"
5. Select new image
6. Wait for upload
7. Click "Save"
```

## FAQ

**Q: Can I upload GIF or SVG images?**  
A: No, only JPEG, PNG, and WEBP formats are supported.

**Q: What happens to the original image after upload?**  
A: The original is optimized and converted to WEBP format. The original file is not stored.

**Q: Can I download the uploaded images?**  
A: Yes, right-click on the image and select "Save image as" in your browser.

**Q: How long are images stored?**  
A: Images are stored permanently until manually deleted.

**Q: Can I bulk upload images for multiple products?**  
A: No, images must be uploaded individually per product. Use CSV import for bulk product creation, then add images manually.

**Q: What if I accidentally delete an image?**  
A: Deleted images cannot be recovered. You'll need to upload the image again.

## Tips

- **Batch Processing**: Prepare all product images before starting to upload
- **Naming Convention**: Use descriptive filenames (e.g., `pollo-brasa-front.jpg`)
- **Backup**: Keep original images in a separate folder as backup
- **Testing**: Test image upload with one product before bulk operations
- **Mobile**: Image upload works on mobile devices but desktop is recommended for better experience
