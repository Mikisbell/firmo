import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import {
  createOnboardingChecklist,
  getOnboardingChecklist,
  completeOnboardingStep,
  uncompleteOnboardingStep,
  validateOnboardingComplete,
  markOnboardingComplete,
  getOnboardingStatus,
  resetOnboarding,
} from '../onboarding';
import prisma from '@/src/core/db/prisma';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    onboarding_steps: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    tenant_settings: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Onboarding Service', () => {
  const tenant_id = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createOnboardingChecklist', () => {
    it('should create onboarding checklist with all standard steps', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configure Basic Information',
          description: 'Set up your restaurant name, RUC, and address',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id,
          step_number: 2,
          step_key: 'CONFIGURE_SETTINGS',
          title: 'Configure Settings',
          description: 'Set timezone, currency, and other preferences',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.create).mockResolvedValueOnce(
        mockSteps[0]
      );
      vi.mocked(prisma.onboarding_steps.create).mockResolvedValueOnce(
        mockSteps[1]
      );

      // Mock remaining steps
      for (let i = 2; i < 7; i++) {
        vi.mocked(prisma.onboarding_steps.create).mockResolvedValueOnce({
          id: randomUUID(),
          tenant_id,
          step_number: i + 1,
          step_key: `STEP_${i}`,
          title: `Step ${i}`,
          description: `Description ${i}`,
          is_required: i < 5,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      const checklist = await createOnboardingChecklist(tenant_id);

      expect(checklist.tenant_id).toBe(tenant_id);
      expect(checklist.status).toBe('IN_PROGRESS');
      expect(checklist.steps.length).toBe(7);
      expect(checklist.completion_percentage).toBe(0);
    });

    it('should create required and optional steps', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configure Basic Information',
          description: 'Set up your restaurant name, RUC, and address',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.create).mockResolvedValue(
        mockSteps[0]
      );

      const checklist = await createOnboardingChecklist(tenant_id);

      const requiredSteps = checklist.steps.filter((s) => s.is_required);
      const optionalSteps = checklist.steps.filter((s) => !s.is_required);

      expect(requiredSteps.length).toBeGreaterThan(0);
      expect(optionalSteps.length).toBeGreaterThan(0);
    });
  });

  describe('getOnboardingChecklist', () => {
    it('should retrieve onboarding checklist', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configure Basic Information',
          description: 'Set up your restaurant name, RUC, and address',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id,
          step_number: 2,
          step_key: 'CONFIGURE_SETTINGS',
          title: 'Configure Settings',
          description: 'Set timezone, currency, and other preferences',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      const checklist = await getOnboardingChecklist(tenant_id);

      expect(checklist.tenant_id).toBe(tenant_id);
      expect(checklist.steps.length).toBe(2);
      expect(checklist.completion_percentage).toBe(50);
      expect(checklist.status).toBe('IN_PROGRESS');
    });

    it('should throw error if checklist not found', async () => {
      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce([]);

      await expect(getOnboardingChecklist(tenant_id)).rejects.toThrow(
        'Onboarding checklist not found'
      );
    });

    it('should calculate completion percentage correctly', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'STEP_1',
          title: 'Step 1',
          description: 'Description 1',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id,
          step_number: 2,
          step_key: 'STEP_2',
          title: 'Step 2',
          description: 'Description 2',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id,
          step_number: 3,
          step_key: 'STEP_3',
          title: 'Step 3',
          description: 'Description 3',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      const checklist = await getOnboardingChecklist(tenant_id);

      expect(checklist.completion_percentage).toBe(67);
    });
  });

  describe('completeOnboardingStep', () => {
    it('should mark step as completed', async () => {
      const step_key = 'CONFIGURE_BASIC_INFO';
      const completed_by = randomUUID();

      const mockStep = {
        id: randomUUID(),
        tenant_id,
        step_number: 1,
        step_key,
        title: 'Configure Basic Information',
        description: 'Set up your restaurant name, RUC, and address',
        is_required: true,
        is_completed: false,
        completed_at: null,
        completed_by: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedStep = {
        ...mockStep,
        is_completed: true,
        completed_at: new Date(),
        completed_by,
      };

      vi.mocked(prisma.onboarding_steps.findUnique).mockResolvedValueOnce(
        mockStep
      );
      vi.mocked(prisma.onboarding_steps.update).mockResolvedValueOnce(
        updatedStep
      );

      const result = await completeOnboardingStep(
        tenant_id,
        step_key,
        completed_by
      );

      expect(result.is_completed).toBe(true);
      expect(result.completed_by).toBe(completed_by);
    });

    it('should throw error if step not found', async () => {
      vi.mocked(prisma.onboarding_steps.findUnique).mockResolvedValueOnce(
        null
      );

      await expect(
        completeOnboardingStep(tenant_id, 'NONEXISTENT_STEP')
      ).rejects.toThrow('Onboarding step NONEXISTENT_STEP not found');
    });
  });

  describe('uncompleteOnboardingStep', () => {
    it('should mark step as incomplete', async () => {
      const step_key = 'CONFIGURE_BASIC_INFO';

      const mockStep = {
        id: randomUUID(),
        tenant_id,
        step_number: 1,
        step_key,
        title: 'Configure Basic Information',
        description: 'Set up your restaurant name, RUC, and address',
        is_required: true,
        is_completed: true,
        completed_at: new Date(),
        completed_by: randomUUID(),
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedStep = {
        ...mockStep,
        is_completed: false,
        completed_at: null,
        completed_by: null,
      };

      vi.mocked(prisma.onboarding_steps.findUnique).mockResolvedValueOnce(
        mockStep
      );
      vi.mocked(prisma.onboarding_steps.update).mockResolvedValueOnce(
        updatedStep
      );

      const result = await uncompleteOnboardingStep(tenant_id, step_key);

      expect(result.is_completed).toBe(false);
      expect(result.completed_at).toBeNull();
      expect(result.completed_by).toBeNull();
    });
  });

  describe('validateOnboardingComplete', () => {
    it('should return is_complete true when all required steps are done', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'STEP_1',
          title: 'Step 1',
          description: 'Description 1',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id,
          step_number: 2,
          step_key: 'STEP_2',
          title: 'Step 2',
          description: 'Description 2',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      const result = await validateOnboardingComplete(tenant_id);

      expect(result.is_complete).toBe(true);
      expect(result.missing_steps).toHaveLength(0);
      expect(result.completion_percentage).toBe(100);
    });

    it('should return is_complete false when required steps are missing', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'STEP_1',
          title: 'Step 1',
          description: 'Description 1',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id,
          step_number: 2,
          step_key: 'STEP_2',
          title: 'Step 2',
          description: 'Description 2',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      const result = await validateOnboardingComplete(tenant_id);

      expect(result.is_complete).toBe(false);
      expect(result.missing_steps).toContain('STEP_2');
    });

    it('should ignore optional steps in completion check', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'STEP_1',
          title: 'Step 1',
          description: 'Description 1',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id,
          step_number: 2,
          step_key: 'STEP_2',
          title: 'Step 2',
          description: 'Description 2',
          is_required: false,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      const result = await validateOnboardingComplete(tenant_id);

      expect(result.is_complete).toBe(true);
      expect(result.missing_steps).toHaveLength(0);
    });
  });

  describe('markOnboardingComplete', () => {
    it('should mark onboarding as complete when all required steps are done', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'STEP_1',
          title: 'Step 1',
          description: 'Description 1',
          is_required: true,
          is_completed: true,
          completed_at: new Date(),
          completed_by: randomUUID(),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );
      vi.mocked(prisma.tenant_settings.update).mockResolvedValueOnce({
        tenant_id,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: 'Test Address',
        logo_url: null,
        timezone: 'America/Lima',
        currency: 'PEN',
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 0,
        require_payment_verification: false,
        allow_cod: true,
        default_payment_expectation: 'PREPAID',
        enable_tips: true,
        tips_on_invoice: false,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 1,
        require_manager_for_offline: true,
        yape_merchant_phone: null,
        yape_merchant_name: null,
        plin_merchant_phone: null,
        plin_merchant_name: null,
        onboarding_status: 'COMPLETED',
        updated_at: new Date(),
      });

      await markOnboardingComplete(tenant_id);

      expect(prisma.tenant_settings.update).toHaveBeenCalledWith({
        where: { tenant_id },
        data: expect.objectContaining({
          onboarding_status: 'COMPLETED',
        }),
      });
    });

    it('should throw error if required steps are not complete', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'STEP_1',
          title: 'Step 1',
          description: 'Description 1',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      await expect(markOnboardingComplete(tenant_id)).rejects.toThrow(
        'Cannot mark onboarding complete'
      );
    });
  });

  describe('getOnboardingStatus', () => {
    it('should return onboarding status', async () => {
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: 'Test Address',
        logo_url: null,
        timezone: 'America/Lima',
        currency: 'PEN',
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 0,
        require_payment_verification: false,
        allow_cod: true,
        default_payment_expectation: 'PREPAID',
        enable_tips: true,
        tips_on_invoice: false,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 1,
        require_manager_for_offline: true,
        yape_merchant_phone: null,
        yape_merchant_name: null,
        plin_merchant_phone: null,
        plin_merchant_name: null,
        onboarding_status: 'IN_PROGRESS',
        updated_at: new Date(),
      });

      const status = await getOnboardingStatus(tenant_id);

      expect(status).toBe('IN_PROGRESS');
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding for a tenant', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'STEP_1',
          title: 'Step 1',
          description: 'Description 1',
          is_required: true,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(prisma.onboarding_steps.deleteMany).mockResolvedValueOnce({
        count: 1,
      });
      vi.mocked(prisma.onboarding_steps.create).mockResolvedValue(
        mockSteps[0]
      );
      vi.mocked(prisma.tenant_settings.update).mockResolvedValueOnce({
        tenant_id,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: 'Test Address',
        logo_url: null,
        timezone: 'America/Lima',
        currency: 'PEN',
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 0,
        require_payment_verification: false,
        allow_cod: true,
        default_payment_expectation: 'PREPAID',
        enable_tips: true,
        tips_on_invoice: false,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 1,
        require_manager_for_offline: true,
        yape_merchant_phone: null,
        yape_merchant_name: null,
        plin_merchant_phone: null,
        plin_merchant_name: null,
        onboarding_status: 'IN_PROGRESS',
        updated_at: new Date(),
      });

      await resetOnboarding(tenant_id);

      expect(prisma.onboarding_steps.deleteMany).toHaveBeenCalledWith({
        where: { tenant_id },
      });
      expect(prisma.tenant_settings.update).toHaveBeenCalledWith({
        where: { tenant_id },
        data: expect.objectContaining({
          onboarding_status: 'IN_PROGRESS',
        }),
      });
    });
  });
});
