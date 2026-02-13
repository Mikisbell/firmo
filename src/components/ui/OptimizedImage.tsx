"use client";

/**
 * OptimizedImage Component
 * Wrapper for images with lazy loading and placeholder support
 * 
 * Task 14.2 - Mobile Responsive Spec
 * Requirements: 9.3
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/src/lib/utils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholderClassName?: string;
  /** Enable lazy loading (default: true) */
  lazy?: boolean;
  /** Show skeleton while loading (default: true) */
  showSkeleton?: boolean;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback on error */
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  placeholderClassName,
  lazy = true,
  showSkeleton = true,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // Start loading 50px before entering viewport
        threshold: 0,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  return (
    <div
      ref={imgRef}
      className={cn("relative overflow-hidden", className)}
      style={{ width, height }}
    >
      {/* Skeleton placeholder */}
      {showSkeleton && !isLoaded && !hasError && (
        <div
          className={cn(
            "absolute inset-0 animate-pulse bg-zinc-800/50 rounded",
            placeholderClassName
          )}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/50 rounded">
          <span className="text-zinc-500 text-xs">Error</span>
        </div>
      )}

      {/* Actual image */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
        />
      )}
    </div>
  );
}

/**
 * Product image with optimized loading
 */
export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      lazy={true}
      showSkeleton={true}
      className={cn("rounded-lg", className)}
    />
  );
}

export default OptimizedImage;
