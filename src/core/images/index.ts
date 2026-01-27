/**
 * Image Service Module
 * 
 * Exports image upload, optimization, and storage functionality.
 */

export {
  ImageService,
  uploadImage,
  deleteImage,
  deleteProductImages,
  optimizeImage,
  generateImageVersions,
  validateFile,
  validateFileSignature,
  type UploadedImage,
  type OptimizeOptions,
  type ImageVersion,
} from './image.service';

