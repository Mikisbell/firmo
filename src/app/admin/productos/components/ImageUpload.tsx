'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, GripVertical, Image as ImageIcon } from 'lucide-react';
import type { ProductImage } from '@/src/core/types/product-images';
import { IMAGE_CONSTANTS } from '@/src/core/types/product-images';

const { MAX_FILE_SIZE, MAX_IMAGES_PER_PRODUCT, ACCEPTED_MIME_TYPES } = IMAGE_CONSTANTS;

interface ImageUploadProps {
  productId?: string;
  existingImages?: ProductImage[];
  maxImages?: number;
  maxSizeBytes?: number;
  onImagesChange: (images: ProductImage[]) => void;
  disabled?: boolean;
}

interface ImagePreview {
  id: string;
  file?: File;
  preview: string;
  order: number;
  uploading?: boolean;
  error?: string;
}

export function ImageUpload({
  productId,
  existingImages = [],
  maxImages = MAX_IMAGES_PER_PRODUCT,
  maxSizeBytes = MAX_FILE_SIZE,
  onImagesChange,
  disabled = false,
}: ImageUploadProps) {
  const [images, setImages] = useState<ImagePreview[]>(
    existingImages.map((img, index) => ({
      id: img.id,
      preview: img.thumbnail_url,
      order: index,
    }))
  );
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Validate file signature (magic bytes)
  const validateFileSignature = async (file: File): Promise<boolean> => {
    try {
      const buffer = await file.slice(0, 12).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // JPEG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return file.type === 'image/jpeg';
      }

      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return file.type === 'image/png';
      }

      // WEBP: 52 49 46 46 ... 57 45 42 50
      if (
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      ) {
        return file.type === 'image/webp';
      }

      return false;
    } catch {
      return false;
    }
  };

  // Validate single file
  const validateFile = useCallback(async (file: File): Promise<string | null> => {
    // Check file type
    if (!ACCEPTED_MIME_TYPES.includes(file.type as any)) {
      return `${file.name}: Invalid format. Must be JPG, PNG, or WEBP`;
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      return `${file.name}: File size exceeds ${maxMB}MB limit`;
    }

    // Check file signature
    const validSignature = await validateFileSignature(file);
    if (!validSignature) {
      return `${file.name}: File signature does not match extension`;
    }

    return null;
  }, [maxSizeBytes]);

  // Create image preview
  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file selection
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newErrors: string[] = [];
    const newImages: ImagePreview[] = [];

    // Check max images limit
    if (images.length + files.length > maxImages) {
      newErrors.push(`Cannot add more than ${maxImages} images per product`);
      setErrors(newErrors);
      return;
    }

    // Validate and process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = await validateFile(file);

      if (error) {
        newErrors.push(error);
      } else {
        try {
          const preview = await createImagePreview(file);
          newImages.push({
            id: `temp-${Date.now()}-${i}`,
            file,
            preview,
            order: images.length + newImages.length,
          });
        } catch {
          newErrors.push(`${file.name}: Failed to create preview`);
        }
      }
    }

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      
      // Notify parent component (for now, just with preview data)
      // In Task 5, this will trigger actual upload
      onImagesChange(updatedImages as any);
    }

    setErrors(newErrors);
  }, [images, maxImages, onImagesChange, validateFile]);

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  // Handle click on dropzone
  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  // Handle delete image
  const handleDelete = useCallback((id: string) => {
    const updatedImages = images.filter(img => img.id !== id)
      .map((img, index) => ({ ...img, order: index }));
    setImages(updatedImages);
    onImagesChange(updatedImages as any);
  }, [images, onImagesChange]);

  // Handle reorder (simple up/down for now)
  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    const reordered = newImages.map((img, i) => ({ ...img, order: i }));
    setImages(reordered);
    onImagesChange(reordered as any);
  }, [images, onImagesChange]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === images.length - 1) return;
    const newImages = [...images];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    const reordered = newImages.map((img, i) => ({ ...img, order: i }));
    setImages(reordered);
    onImagesChange(reordered as any);
  }, [images, onImagesChange]);

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      {canAddMore && (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_MIME_TYPES.join(',')}
            onChange={handleFileInputChange}
            disabled={disabled}
            className="hidden"
            aria-label="Upload product images"
          />

          <div className="flex flex-col items-center gap-2">
            <Upload className="w-12 h-12 text-gray-400" />
            <div className="text-sm text-gray-600">
              {dragActive ? (
                <p className="font-medium text-blue-600">Drop images here</p>
              ) : (
                <>
                  <p className="font-medium">Drag & drop images here, or click to select</p>
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, PNG, or WEBP • Max {(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB per file • 
                    Up to {maxImages} images
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm font-medium text-red-800 mb-1">Upload Errors:</p>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Images ({images.length}/{maxImages})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200"
              >
                {/* Image */}
                <img
                  src={image.preview}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Primary badge */}
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                    Primary
                  </div>
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity duration-200">
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {/* Move up */}
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="Move image up"
                        title="Move up"
                      >
                        <GripVertical className="w-4 h-4 text-gray-700 rotate-90" />
                      </button>
                    )}

                    {/* Move down */}
                    {index < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="Move image down"
                        title="Move down"
                      >
                        <GripVertical className="w-4 h-4 text-gray-700 -rotate-90" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(image.id)}
                      className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                      aria-label="Delete image"
                      title="Delete"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Order indicator */}
                <div className="absolute bottom-2 right-2 bg-gray-900 bg-opacity-75 text-white text-xs font-medium px-2 py-1 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no images */}
      {images.length === 0 && !canAddMore && (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No images uploaded</p>
        </div>
      )}
    </div>
  );
}
