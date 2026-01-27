/**
 * Product Type Definitions
 * 
 * Comprehensive type definitions for products in PARK POS.
 * Extends Prisma-generated types with additional fields and utilities.
 * 
 * @see .kiro/specs/products-p1-improvements/design.md
 */

import { products as PrismaProduct } from '@prisma/client';
import { ProductImage } from './product-images';
import { Centavos, unsafeCentavos } from './shared';

/**
 * Product type with images support
 * 
 * Extends the Prisma products type to include properly typed images field.
 * The images field in Prisma is Json type, but we want it strongly typed.
 */
export interface Product extends Omit<PrismaProduct, 'images' | 'price_cents'> {
  /** Product images (0-5 images) */
  images: ProductImage[];
  
  /** Price in centavos (branded type for type safety) */
  price_cents: Centavos;
}

/**
 * Product without images (for list views)
 * 
 * Lighter type for product lists where images aren't needed.
 * Improves performance by not loading image data.
 */
export type ProductListItem = Omit<Product, 'images'>;

/**
 * Product with primary image only (for list views with thumbnails)
 * 
 * Includes only the primary image (order=0) for efficient list rendering.
 */
export interface ProductWithThumbnail extends ProductListItem {
  /** Primary image thumbnail (if exists) */
  primary_image_thumbnail?: string;
}

/**
 * Product creation data
 * 
 * Data required to create a new product.
 * Images are optional and can be added after creation.
 */
export interface CreateProductData {
  sku: string;
  name: string;
  short_name?: string | null;
  price_cents: Centavos;
  category: string;
  station: string;
  type?: string;
  is_active?: boolean;
  images?: ProductImage[];
}

/**
 * Product update data
 * 
 * All fields are optional for partial updates.
 */
export interface UpdateProductData {
  sku?: string;
  name?: string;
  short_name?: string | null;
  price_cents?: Centavos;
  category?: string;
  station?: string;
  type?: string;
  is_active?: boolean;
  images?: ProductImage[];
}

/**
 * Product filter options
 * 
 * Options for filtering product lists.
 */
export interface ProductFilters {
  is_active?: boolean;
  category?: string;
  station?: string;
  search?: string;
}

/**
 * Product with metadata
 * 
 * Product with additional computed metadata for display.
 */
export interface ProductWithMetadata extends Product {
  /** Number of images */
  image_count: number;
  
  /** Has primary image */
  has_primary_image: boolean;
  
  /** Formatted price (e.g., "S/ 25.00") */
  formatted_price: string;
}

/**
 * Converts a Prisma product to a Product type
 * 
 * Handles type conversion for images (Json -> ProductImage[])
 * and price_cents (number -> Centavos).
 */
export function fromPrismaProduct(prismaProduct: PrismaProduct): Product {
  return {
    ...prismaProduct,
    images: Array.isArray(prismaProduct.images) 
      ? (prismaProduct.images as unknown as ProductImage[])
      : [],
    price_cents: unsafeCentavos(prismaProduct.price_cents),
  };
}

/**
 * Converts a Product to Prisma-compatible data
 * 
 * Handles type conversion for database storage.
 */
export function toPrismaProduct(product: Product): PrismaProduct {
  return {
    ...product,
    images: product.images as any, // Prisma expects Json type
    price_cents: product.price_cents as number,
  };
}

/**
 * Gets the primary image from a product
 * 
 * Returns the image with order=0, or undefined if no images.
 */
export function getPrimaryImage(product: Product): ProductImage | undefined {
  return product.images.find(img => img.order === 0);
}

/**
 * Gets the primary image thumbnail URL
 * 
 * Returns the thumbnail URL of the primary image, or undefined.
 */
export function getPrimaryImageThumbnail(product: Product): string | undefined {
  const primaryImage = getPrimaryImage(product);
  return primaryImage?.thumbnail_url;
}

/**
 * Checks if a product has images
 */
export function hasImages(product: Product): boolean {
  return product.images.length > 0;
}

/**
 * Checks if a product can accept more images
 */
export function canAddMoreImages(product: Product): boolean {
  return product.images.length < 5;
}

/**
 * Formats a product price for display
 * 
 * @example
 * formatPrice(2500) // "S/ 25.00"
 */
export function formatProductPrice(price_cents: Centavos): string {
  const soles = price_cents / 100;
  return `S/ ${soles.toFixed(2)}`;
}

/**
 * Creates a ProductWithMetadata from a Product
 */
export function withMetadata(product: Product): ProductWithMetadata {
  return {
    ...product,
    image_count: product.images.length,
    has_primary_image: getPrimaryImage(product) !== undefined,
    formatted_price: formatProductPrice(product.price_cents),
  };
}
