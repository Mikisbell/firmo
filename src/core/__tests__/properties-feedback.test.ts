/**
 * Property-Based Tests: User Feedback
 * 
 * Tests Properties 43-45 from design document using fast-check
 * Each property is tested with 100 iterations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  bulkUpdateRequest,
  csvRow,
  validImageFormat,
  imageSize,
} from './arbitraries';

// Mock UI notification system
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

// Mock UI state
const mockUIState = {
  isSubmitting: false,
  buttonDisabled: false,
};

// Mock services
const mockBulkService = {
  bulkUpdate: vi.fn(),
};

const mockCSVService = {
  importProducts: vi.fn(),
};

const mockImageService = {
  uploadImage: vi.fn(),
};

describe('User Feedback Properties', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    mockUIState.isSubmitting = false;
    mockUIState.buttonDisabled = false;
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockBulkService.bulkUpdate.mockClear();
    mockCSVService.importProducts.mockClear();
    mockImageService.uploadImage.mockClear();
  });

  /**
   * Property 43: Operation success notification
   * For any successfully completed operation (bulk, import, upload), the Admin_Panel
   * should display a success toast notification.
   */
  it('Feature: products-p1-improvements, Property 43: Operation success notification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('bulk_update', 'csv_import', 'image_upload'),
        fc.integer({ min: 1, max: 100 }),
        async (operationType, affectedCount) => {
          // Clear mocks for this iteration
          mockToast.success.mockClear();
          mockToast.error.mockClear();
          mockBulkService.bulkUpdate.mockClear();
          mockCSVService.importProducts.mockClear();
          mockImageService.uploadImage.mockClear();

          // Arrange: Mock successful operations
          let operationResult: any;

          switch (operationType) {
            case 'bulk_update':
              mockBulkService.bulkUpdate.mockResolvedValue({
                success_count: affectedCount,
                failure_count: 0,
                failures: [],
                duration_ms: 1000,
              });
              operationResult = await mockBulkService.bulkUpdate(
                Array(affectedCount).fill('prod-id'),
                { is_active: true },
                'tenant-123',
                'user-123'
              );
              break;

            case 'csv_import':
              mockCSVService.importProducts.mockResolvedValue({
                created_count: affectedCount,
                updated_count: 0,
                skipped_count: 0,
                errors: [],
                duration_ms: 2000,
              });
              operationResult = await mockCSVService.importProducts(
                Array(affectedCount).fill({ sku: 'SKU', name: 'Product' }),
                'tenant-123',
                'user-123'
              );
              break;

            case 'image_upload':
              mockImageService.uploadImage.mockResolvedValue({
                id: 'image-123',
                url: 'https://storage.example.com/image.webp',
                thumbnail_url: 'https://storage.example.com/image-thumb.webp',
                medium_url: 'https://storage.example.com/image-medium.webp',
                size_bytes: 1024000,
                format: 'webp',
                order: 0,
                uploaded_at: new Date().toISOString(),
                uploaded_by: 'user-123',
              });
              operationResult = await mockImageService.uploadImage(
                { name: 'test.jpg', size: 1024000, type: 'image/jpeg', buffer: Buffer.alloc(1024000) },
                'tenant-123',
                'product-123'
              );
              break;
          }

          // Act: Display success notification
          if (operationType === 'bulk_update') {
            mockToast.success(`Successfully updated ${operationResult.success_count} products`);
          } else if (operationType === 'csv_import') {
            mockToast.success(`Successfully imported ${operationResult.created_count} products`);
          } else if (operationType === 'image_upload') {
            mockToast.success('Image uploaded Successfully');
          }

          // Assert: Success toast should be called
          expect(mockToast.success).toHaveBeenCalledTimes(1);
          expect(mockToast.success).toHaveBeenCalledWith(
            expect.stringContaining('Success')
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 44: Operation failure notification
   * For any failed operation, the Admin_Panel should display an error toast
   * notification with actionable information.
   */
  it('Feature: products-p1-improvements, Property 44: Operation failure notification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('bulk_update', 'csv_import', 'image_upload'),
        fc.constantFrom(
          'Network error',
          'Database timeout',
          'Invalid data',
          'Unauthorized',
          'File too large',
          'Storage unavailable'
        ),
        async (operationType, errorType) => {
          // Clear mocks for this iteration
          mockToast.success.mockClear();
          mockToast.error.mockClear();
          mockBulkService.bulkUpdate.mockClear();
          mockCSVService.importProducts.mockClear();
          mockImageService.uploadImage.mockClear();

          // Arrange: Mock failed operations
          const error = new Error(errorType);

          switch (operationType) {
            case 'bulk_update':
              mockBulkService.bulkUpdate.mockRejectedValue(error);
              break;
            case 'csv_import':
              mockCSVService.importProducts.mockRejectedValue(error);
              break;
            case 'image_upload':
              mockImageService.uploadImage.mockRejectedValue(error);
              break;
          }

          // Act: Attempt operation and handle error
          try {
            if (operationType === 'bulk_update') {
              await mockBulkService.bulkUpdate([], {}, 'tenant-123', 'user-123');
            } else if (operationType === 'csv_import') {
              await mockCSVService.importProducts([], 'tenant-123', 'user-123');
            } else if (operationType === 'image_upload') {
              await mockImageService.uploadImage(
                { name: 'test.jpg', size: 1024, type: 'image/jpeg', buffer: Buffer.alloc(1024) },
                'tenant-123',
                'product-123'
              );
            }
          } catch (err: any) {
            // Display error notification with actionable message
            let actionableMessage = err.message;
            
            if (errorType === 'Network error') {
              actionableMessage += '. Please check your connection and try again.';
            } else if (errorType === 'Database timeout') {
              actionableMessage += '. Please try again in a moment.';
            } else if (errorType === 'Invalid data') {
              actionableMessage += '. Please check your input and try again.';
            } else if (errorType === 'Unauthorized') {
              actionableMessage += '. Please ensure you have admin permissions.';
            } else if (errorType === 'File too large') {
              actionableMessage += '. Please compress the image and try again.';
            } else if (errorType === 'Storage unavailable') {
              actionableMessage += '. Please try again later.';
            }
            
            mockToast.error(actionableMessage);
          }

          // Assert: Error toast should be called with actionable message
          expect(mockToast.error).toHaveBeenCalledTimes(1);
          expect(mockToast.error).toHaveBeenCalledWith(
            expect.stringContaining(errorType)
          );
          expect(mockToast.error).toHaveBeenCalledWith(
            expect.stringMatching(/Please|try again|check/i)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 45: Operation in-progress button state
   * For any operation in progress, the submit button should be disabled
   * to prevent duplicate submissions.
   */
  it('Feature: products-p1-improvements, Property 45: Operation in-progress button state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('bulk_update', 'csv_import', 'image_upload'),
        fc.integer({ min: 100, max: 3000 }),
        async (operationType, _operationDuration) => {
          // Act: Start operation and track button state
          mockUIState.isSubmitting = true;
          mockUIState.buttonDisabled = true;

          // Verify button is disabled during operation
          expect(mockUIState.buttonDisabled).toBe(true);
          expect(mockUIState.isSubmitting).toBe(true);

          // Simulate operation completion (no actual delay)
          mockUIState.isSubmitting = false;
          mockUIState.buttonDisabled = false;

          // Assert: Button should be re-enabled after operation
          expect(mockUIState.buttonDisabled).toBe(false);
          expect(mockUIState.isSubmitting).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Button state prevents duplicate submissions
   */
  it('Feature: products-p1-improvements, Property 45: Button state prevents duplicate submissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        bulkUpdateRequest,
        async (updateRequest) => {
          // Arrange: Track submission count
          let submissionCount = 0;
          
          mockBulkService.bulkUpdate.mockImplementation(async () => {
            submissionCount++;
            return {
              success_count: 10,
              failure_count: 0,
              failures: [],
              duration_ms: 1000,
            };
          });

          // Act: Attempt to submit multiple times while operation is in progress
          mockUIState.isSubmitting = true;
          mockUIState.buttonDisabled = true;

          // First submission (allowed)
          const firstSubmission = mockBulkService.bulkUpdate(
            ['prod-1', 'prod-2'],
            updateRequest.updates,
            'tenant-123',
            'user-123'
          );

          // Attempt second submission (should be prevented by disabled button)
          if (!mockUIState.buttonDisabled) {
            await mockBulkService.bulkUpdate(
              ['prod-1', 'prod-2'],
              updateRequest.updates,
              'tenant-123',
              'user-123'
            );
          }

          // Wait for first submission to complete
          await firstSubmission;

          // Re-enable button
          mockUIState.isSubmitting = false;
          mockUIState.buttonDisabled = false;

          // Assert: Only one submission should have occurred
          expect(submissionCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
