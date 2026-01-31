-- Add images support to products table
-- Migration: 20260127_add_product_images

-- Add images column (JSONB array of image URLs)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_products_images_gin 
ON products USING GIN (images);

-- Add comment for documentation
COMMENT ON COLUMN products.images IS 'Array of image URLs for the product. Format: [{"url": "https://...", "alt": "...", "is_primary": true}]';
