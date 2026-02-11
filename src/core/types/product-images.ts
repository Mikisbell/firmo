/**
 * Tipos para imágenes de productos
 * 
 * Define la estructura de datos para las imágenes de productos,
 * incluyendo URLs optimizadas, metadatos y orden de visualización.
 * 
 * @module core/types/product-images
 */

/**
 * Formato de imagen soportado
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp';

/**
 * Imagen de producto con URLs optimizadas
 */
export interface ProductImage {
  /** ID único de la imagen */
  id: string;
  
  /** URL de la imagen original */
  url: string;
  
  /** URL de la miniatura (thumbnail) */
  thumbnail_url: string;
  
  /** URL de la imagen de tamaño medio */
  medium_url: string;
  
  /** Tamaño del archivo en bytes */
  size_bytes: number;
  
  /** Formato de la imagen */
  format: ImageFormat;
  
  /** Orden de visualización (0 = imagen principal) */
  order: number;
  
  /** Fecha de subida (ISO 8601) */
  uploaded_at: string;
  
  /** ID del usuario que subió la imagen */
  uploaded_by: string;
}

/**
 * Constantes de validación para imágenes
 */
export const IMAGE_VALIDATION = {
  /** Tamaño máximo de archivo: 5MB */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  
  /** Número máximo de imágenes por producto */
  MAX_IMAGES: 5,
  
  /** Formatos de imagen permitidos */
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'] as const,
  
  /** Extensiones de archivo permitidas */
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'] as const,
} as const;

/**
 * Resultado de validación de imagen
 */
export interface ImageValidationResult {
  /** Indica si la imagen es válida */
  valid: boolean;
  
  /** Mensaje de error si la validación falla */
  error?: string;
}

/**
 * Valida un archivo de imagen
 * 
 * @param file - Archivo a validar
 * @param existingImagesCount - Número de imágenes existentes
 * @returns Resultado de la validación
 */
export function validateImageFile(
  file: File,
  existingImagesCount: number = 0
): ImageValidationResult {
  // Validar número máximo de imágenes
  if (existingImagesCount >= IMAGE_VALIDATION.MAX_IMAGES) {
    return {
      valid: false,
      error: `Máximo ${IMAGE_VALIDATION.MAX_IMAGES} imágenes permitidas`,
    };
  }

  // Validar tamaño de archivo
  if (file.size > IMAGE_VALIDATION.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo de ${IMAGE_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  // Validar formato
  if (!IMAGE_VALIDATION.ALLOWED_FORMATS.includes(file.type as any)) {
    return {
      valid: false,
      error: `Formato no permitido. Use: ${IMAGE_VALIDATION.ALLOWED_FORMATS.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Obtiene la imagen principal de un producto
 * 
 * @param images - Array de imágenes del producto
 * @returns Imagen principal (order = 0) o undefined si no hay imágenes
 */
export function getPrimaryImage(images: ProductImage[]): ProductImage | undefined {
  return images.find(img => img.order === 0) || images[0];
}

/**
 * Reordena imágenes después de eliminar una
 * 
 * @param images - Array de imágenes
 * @param deletedImageId - ID de la imagen eliminada
 * @returns Array de imágenes con orden actualizado
 */
export function reorderAfterDeletion(
  images: ProductImage[],
  deletedImageId: string
): ProductImage[] {
  return images
    .filter(img => img.id !== deletedImageId)
    .map((img, index) => ({ ...img, order: index }));
}
