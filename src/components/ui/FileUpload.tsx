'use client';

/**
 * FileUpload — Zona de carga de archivos/imagenes del Design System.
 *
 * Caracteristicas:
 * - Drop zone con borde punteado y estado hover
 * - Click para seleccionar o drag-and-drop
 * - Preview de imagen si existe (o tras seleccionar)
 * - Validacion de tipo (via accept) y tamanio maximo
 * - Estado de carga (disable + spinner)
 */

import { useId, useRef, useState, DragEvent, ChangeEvent } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface FileUploadProps {
  /** Tipos aceptados (e.g. "image/*", ".pdf,.doc") */
  accept?: string;
  /** Tamanio maximo en bytes (default 5MB) */
  maxSize?: number;
  /** Callback al subir archivo valido */
  onUpload: (file: File) => void | Promise<void>;
  /** URL de preview actual (imagen ya subida) */
  preview?: string | null;
  /** Etiqueta del campo */
  label?: string;
  /** Mensaje de error externo */
  error?: string;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB

/** Formatea bytes a formato legible (KB, MB, GB) */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Verifica si un MIME type coincide con un patron accept */
function matchesAccept(fileType: string, fileName: string, accept: string): boolean {
  const patterns = accept.split(',').map((s) => s.trim().toLowerCase());
  const lowerType = fileType.toLowerCase();
  const lowerName = fileName.toLowerCase();

  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) {
      return lowerName.endsWith(pattern);
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1); // "image/"
      return lowerType.startsWith(prefix);
    }
    return lowerType === pattern;
  });
}

export function FileUpload({
  accept,
  maxSize = DEFAULT_MAX_SIZE,
  onUpload,
  preview,
  label,
  error,
}: FileUploadProps) {
  const autoId = useId();
  const inputId = `${autoId}-file`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displayError = error ?? localError;
  const displayPreview = preview ?? localPreview;
  const isImagePreview =
    displayPreview &&
    (accept?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(displayPreview));

  const validateFile = (file: File): string | null => {
    if (accept && !matchesAccept(file.type, file.name, accept)) {
      return `Tipo de archivo no permitido. Aceptados: ${accept}`;
    }
    if (file.size > maxSize) {
      return `Archivo demasiado grande. Maximo: ${formatBytes(maxSize)}`;
    }
    return null;
  };

  const handleFile = async (file: File) => {
    setLocalError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    // Preview local si es imagen
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setLocalPreview(url);
    }

    try {
      setIsUploading(true);
      await onUpload(file);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Error al subir el archivo',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset para permitir re-seleccion del mismo archivo
    e.target.value = '';
  };

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
    }
    setLocalPreview(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-park-gray-300">{label}</span>
      )}

      <label
        htmlFor={inputId}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2',
          'min-h-[140px] w-full p-4 rounded-lg border-2 border-dashed',
          'transition-colors cursor-pointer',
          isDragging
            ? 'border-park-brand-500 bg-park-brand-500/5'
            : 'border-park-gray-700 hover:border-park-brand-500 hover:bg-park-brand-500/5',
          displayError && 'border-red-500',
          isUploading && 'opacity-60 cursor-not-allowed',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={isUploading}
          onChange={handleInputChange}
          className="sr-only"
        />

        {displayPreview && isImagePreview ? (
          <div className="relative w-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPreview}
              alt="Preview"
              className="max-h-32 max-w-full rounded object-contain"
            />
            {!isUploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-0 right-0 p-1 rounded-full bg-park-gray-900/90 text-park-gray-300 hover:text-white hover:bg-red-500/20 transition-colors"
                aria-label="Quitar imagen"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {isUploading ? (
              <Loader2 className="h-8 w-8 text-park-brand-500 animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-park-gray-500" />
            )}
            <div className="text-center">
              <p className="text-sm text-park-gray-300">
                {isUploading
                  ? 'Subiendo...'
                  : 'Arrastra una imagen o haz clic'}
              </p>
              <p className="text-xs text-park-gray-500 mt-0.5">
                Maximo {formatBytes(maxSize)}
                {accept && ` · ${accept}`}
              </p>
            </div>
          </>
        )}
      </label>

      {displayError && <p className="text-xs text-red-400">{displayError}</p>}
    </div>
  );
}
