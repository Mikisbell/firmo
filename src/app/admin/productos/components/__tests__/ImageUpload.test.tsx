import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from '../ImageUpload';
import type { ProductImage } from '@/core/types/product-images';

// Mock FileReader
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsDataURL(blob: Blob) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mockbase64data';
      if (this.onload) {
        this.onload({ target: this } as any);
      }
    }, 0);
  }

  readAsArrayBuffer(blob: Blob) {
    setTimeout(() => {
      // Mock JPEG signature: FF D8 FF
      const buffer = new ArrayBuffer(12);
      const view = new Uint8Array(buffer);
      view[0] = 0xFF;
      view[1] = 0xD8;
      view[2] = 0xFF;
      this.result = buffer;
      if (this.onload) {
        this.onload({ target: this } as any);
      }
    }, 0);
  }
}

global.FileReader = MockFileReader as any;

// Helper to create mock File
const createMockFile = (name: string, size: number, type: string): File => {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
};

describe('ImageUpload', () => {
  const mockOnImagesChange = vi.fn();

  beforeEach(() => {
    mockOnImagesChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render dropzone when no images', () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);
      
      expect(screen.getByText(/Drag & drop images here/i)).toBeInTheDocument();
      expect(screen.getByText(/JPG, PNG, or WEBP/i)).toBeInTheDocument();
    });

    it('should render existing images', () => {
      const existingImages: ProductImage[] = [
        {
          id: 'img-1',
          url: 'https://example.com/img1.jpg',
          thumbnail_url: 'https://example.com/img1-thumb.jpg',
          medium_url: 'https://example.com/img1-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 0,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
      ];

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );

      expect(screen.getByAltText('Product image 1')).toBeInTheDocument();
      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Images (1/5)')).toBeInTheDocument();
    });

    it('should hide dropzone when max images reached', () => {
      const existingImages: ProductImage[] = Array.from({ length: 5 }, (_, i) => ({
        id: `img-${i}`,
        url: `https://example.com/img${i}.jpg`,
        thumbnail_url: `https://example.com/img${i}-thumb.jpg`,
        medium_url: `https://example.com/img${i}-medium.jpg`,
        size_bytes: 100000,
        format: 'webp' as const,
        order: i,
        uploaded_at: '2026-01-27T10:00:00Z',
        uploaded_by: 'user-1',
      }));

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );

      expect(screen.queryByText(/Drag & drop images here/i)).not.toBeInTheDocument();
      expect(screen.getByText('Images (5/5)')).toBeInTheDocument();
    });

    it('should disable dropzone when disabled prop is true', () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} disabled />);
      
      const dropzone = screen.getByText(/Drag & drop images here/i).closest('div');
      expect(dropzone).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  describe('File Validation', () => {
    it('should accept valid JPEG file', async () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);
      
      const file = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg');
      const input = screen.getByLabelText('Upload product images') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalled();
      });
    });

    it('should reject file larger than 5MB', async () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);
      
      const file = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg');
      const input = screen.getByLabelText('Upload product images') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/File size exceeds 5MB limit/i)).toBeInTheDocument();
      });
      
      expect(mockOnImagesChange).not.toHaveBeenCalled();
    });

    it('should reject invalid file format', async () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);
      
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      const input = screen.getByLabelText('Upload product images') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/Invalid format/i)).toBeInTheDocument();
      });
      
      expect(mockOnImagesChange).not.toHaveBeenCalled();
    });

    it('should reject more than max images', async () => {
      const existingImages: ProductImage[] = Array.from({ length: 4 }, (_, i) => ({
        id: `img-${i}`,
        url: `https://example.com/img${i}.jpg`,
        thumbnail_url: `https://example.com/img${i}-thumb.jpg`,
        medium_url: `https://example.com/img${i}-medium.jpg`,
        size_bytes: 100000,
        format: 'webp' as const,
        order: i,
        uploaded_at: '2026-01-27T10:00:00Z',
        uploaded_by: 'user-1',
      }));

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );
      
      const files = [
        createMockFile('test1.jpg', 1024, 'image/jpeg'),
        createMockFile('test2.jpg', 1024, 'image/jpeg'),
      ];
      const input = screen.getByLabelText('Upload product images') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: files,
        writable: false,
      });
      
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/Cannot add more than 5 images/i)).toBeInTheDocument();
      });
    });
  });

  describe('Image Management', () => {
    it('should delete image when delete button clicked', async () => {
      const existingImages: ProductImage[] = [
        {
          id: 'img-1',
          url: 'https://example.com/img1.jpg',
          thumbnail_url: 'https://example.com/img1-thumb.jpg',
          medium_url: 'https://example.com/img1-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 0,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
      ];

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );

      const deleteButton = screen.getByLabelText('Delete image');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalledWith([]);
      });
    });

    it('should move image up when move up button clicked', async () => {
      const existingImages: ProductImage[] = [
        {
          id: 'img-1',
          url: 'https://example.com/img1.jpg',
          thumbnail_url: 'https://example.com/img1-thumb.jpg',
          medium_url: 'https://example.com/img1-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 0,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
        {
          id: 'img-2',
          url: 'https://example.com/img2.jpg',
          thumbnail_url: 'https://example.com/img2-thumb.jpg',
          medium_url: 'https://example.com/img2-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 1,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
      ];

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );

      const moveUpButtons = screen.getAllByLabelText('Move image up');
      fireEvent.click(moveUpButtons[0]);

      await waitFor(() => {
        const calls = mockOnImagesChange.mock.calls;
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall[0].id).toBe('img-2');
        expect(lastCall[1].id).toBe('img-1');
      });
    });

    it('should mark first image as primary', () => {
      const existingImages: ProductImage[] = [
        {
          id: 'img-1',
          url: 'https://example.com/img1.jpg',
          thumbnail_url: 'https://example.com/img1-thumb.jpg',
          medium_url: 'https://example.com/img1-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 0,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
        {
          id: 'img-2',
          url: 'https://example.com/img2.jpg',
          thumbnail_url: 'https://example.com/img2-thumb.jpg',
          medium_url: 'https://example.com/img2-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 1,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
      ];

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );

      const primaryBadges = screen.getAllByText('Primary');
      expect(primaryBadges).toHaveLength(1);
    });
  });

  describe('Drag and Drop', () => {
    it('should show drag active state when dragging over', () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);
      
      const dropzone = screen.getByText(/Drag & drop images here/i).closest('div')!;
      
      fireEvent.dragEnter(dropzone, {
        dataTransfer: {
          items: [{ kind: 'file', type: 'image/jpeg' }],
        },
      });

      expect(dropzone).toHaveClass('border-blue-500', 'bg-blue-50');
      expect(screen.getByText('Drop images here')).toBeInTheDocument();
    });

    it('should remove drag active state when dragging out', () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);
      
      const dropzone = screen.getByText(/Drag & drop images here/i).closest('div')!;
      
      fireEvent.dragEnter(dropzone, {
        dataTransfer: {
          items: [{ kind: 'file', type: 'image/jpeg' }],
        },
      });

      fireEvent.dragLeave(dropzone);

      expect(dropzone).not.toHaveClass('border-blue-500', 'bg-blue-50');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);
      
      expect(screen.getByLabelText('Upload product images')).toBeInTheDocument();
    });

    it('should have alt text for images', () => {
      const existingImages: ProductImage[] = [
        {
          id: 'img-1',
          url: 'https://example.com/img1.jpg',
          thumbnail_url: 'https://example.com/img1-thumb.jpg',
          medium_url: 'https://example.com/img1-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 0,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
      ];

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );

      expect(screen.getByAltText('Product image 1')).toBeInTheDocument();
    });

    it('should have title attributes for action buttons', () => {
      const existingImages: ProductImage[] = [
        {
          id: 'img-1',
          url: 'https://example.com/img1.jpg',
          thumbnail_url: 'https://example.com/img1-thumb.jpg',
          medium_url: 'https://example.com/img1-medium.jpg',
          size_bytes: 100000,
          format: 'webp',
          order: 0,
          uploaded_at: '2026-01-27T10:00:00Z',
          uploaded_by: 'user-1',
        },
      ];

      render(
        <ImageUpload 
          existingImages={existingImages}
          onImagesChange={mockOnImagesChange}
        />
      );

      expect(screen.getByTitle('Delete')).toBeInTheDocument();
    });
  });
});
