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
  ONBOARDING_STEPS,
} from '../onboarding';
import prisma from '@/src/core/db/prisma';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    onboarding_steps: {
      create: vi.fn(),
      createMany: vi.fn(),
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

  describe('ONBOARDING_STEPS constant', () => {
    it('should have exactly 6 steps', () => {
      expect(ONBOARDING_STEPS).toHaveLength(6);
    });

    it('should have correct step keys in order', () => {
      const keys = ONBOARDING_STEPS.map((s) => s.step_key);
      expect(keys).toEqual([
        'CONFIGURE_BASIC_INFO',
        'CREATE_EMPLOYEE',
        'CREATE_PRODUCT',
        'CONFIGURE_STATIONS',
        'ACTIVATE_TERMINAL',
        'CONFIGURE_PAYMENT_METHODS',
      ]);
    });

    it('should have all titles in Spanish', () => {
      for (const step of ONBOARDING_STEPS) {
        // Spanish titles should NOT contain common English words
        expect(step.title).not.toMatch(/^Configure |^Create First|^Set up/);
      }
    });

    it('should have 4 required and 2 optional steps', () => {
      const required = ONBOARDING_STEPS.filter((s) => s.is_required);
      const optional = ONBOARDING_STEPS.filter((s) => !s.is_required);
      expect(required).toHaveLength(4);
      expect(optional).toHaveLength(2);
    });

    it('should have sequential step numbers 1-6', () => {
      const numbers = ONBOARDING_STEPS.map((s) => s.step_number);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should have route for each step', () => {
      for (const step of ONBOARDING_STEPS) {
        expect(step.route).toBeDefined();
        expect(step.route).toMatch(/^\/admin\//);
      }
    });
  });

  describe('createOnboardingChecklist', () => {
    /**
     * Helper: build mock steps array from ONBOARDING_STEPS constant
     */
    function buildMockSteps() {
      return ONBOARDING_STEPS.map((stepDef) => ({
        id: randomUUID(),
        tenant_id,
        step_number: stepDef.step_number,
        step_key: stepDef.step_key,
        title: stepDef.title,
        description: stepDef.description,
        is_required: stepDef.is_required,
        is_completed: false,
        completed_at: null,
        completed_by: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      }));
    }

    it('should create onboarding checklist with all 6 unified steps', async () => {
      const mockSteps = buildMockSteps();

      vi.mocked(prisma.onboarding_steps.createMany).mockResolvedValueOnce({
        count: 6,
      });
      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      const checklist = await createOnboardingChecklist(tenant_id);

      expect(checklist.tenant_id).toBe(tenant_id);
      expect(checklist.status).toBe('IN_PROGRESS');
      expect(checklist.steps).toHaveLength(6);
      expect(checklist.completion_percentage).toBe(0);
      expect(prisma.onboarding_steps.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.onboarding_steps.findMany).toHaveBeenCalledWith({
        where: { tenant_id },
        orderBy: { step_number: 'asc' },
      });
    });

    it('should create required and optional steps', async () => {
      const mockSteps = buildMockSteps();

      vi.mocked(prisma.onboarding_steps.createMany).mockResolvedValueOnce({
        count: 6,
      });
      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

      const checklist = await createOnboardingChecklist(tenant_id);

      const requiredSteps = checklist.steps.filter((s) => s.is_required);
      const optionalSteps = checklist.steps.filter((s) => !s.is_required);

      expect(requiredSteps).toHaveLength(4);
      expect(optionalSteps).toHaveLength(2);
    });

    it('should accept optional tx parameter for transactional usage', async () => {
      const mockSteps = buildMockSteps();
      const mockTx = {
        onboarding_steps: {
          createMany: vi.fn().mockResolvedValueOnce({ count: 6 }),
          findMany: vi.fn().mockResolvedValueOnce(mockSteps),
        },
      };

      const checklist = await createOnboardingChecklist(
        tenant_id,
        mockTx as any
      );

      expect(checklist.steps).toHaveLength(6);
      expect(checklist.status).toBe('IN_PROGRESS');
      // Should use tx, NOT the prisma singleton
      expect(mockTx.onboarding_steps.createMany).toHaveBeenCalledTimes(1);
      expect(mockTx.onboarding_steps.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.onboarding_steps.createMany).not.toHaveBeenCalled();
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
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante (nombre, RUC, dirección)',
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
          step_key: 'CREATE_EMPLOYEE',
          title: 'Crear Empleados',
          description: 'Agrega al menos un empleado además del administrador',
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
      expect(checklist.steps).toHaveLength(2);
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
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante',
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
          step_key: 'CREATE_EMPLOYEE',
          title: 'Crear Empleados',
          description: 'Agrega al menos un empleado',
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
          step_key: 'CREATE_PRODUCT',
          title: 'Crear Productos',
          description: 'Agrega los productos que venderás',
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
        title: 'Configurar Información del Negocio',
        description: 'Completa los datos de tu restaurante',
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
        title: 'Configurar Información del Negocio',
        description: 'Completa los datos de tu restaurante',
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
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante',
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
          step_key: 'CREATE_EMPLOYEE',
          title: 'Crear Empleados',
          description: 'Agrega al menos un empleado',
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
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante',
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
          step_key: 'CREATE_EMPLOYEE',
          title: 'Crear Empleados',
          description: 'Agrega al menos un empleado',
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
      expect(result.missing_steps).toContain('CREATE_EMPLOYEE');
    });

    it('should ignore optional steps in completion check', async () => {
      const mockSteps = [
        {
          id: randomUUID(),
          tenant_id,
          step_number: 1,
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante',
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
          step_number: 4,
          step_key: 'CONFIGURE_STATIONS',
          title: 'Configurar Estaciones',
          description: 'Configura las estaciones de cocina',
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
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante',
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
        kds_audio_enabled: true, table_inactivity_threshold_min: 15, sla_normal_min: 15, sla_special_min: 30,
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
        max_cash_opening_cents: 50000,
        cash_variance_alert_cents: 2000,
        require_denomination_count: false,
        tip_max_untaxed_percent: 10,
        sunat_provider: null,
        sunat_mode: null,
        sunat_sol_user: null,
        sunat_sol_password: null,
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
        sunat_cert_expires_at: null,
        nubefact_token: null,
        nubefact_url: null,
        peru_identity_api_token: null,
        loyalty_enabled: false,
        loyalty_points_per_sol: 1,
        loyalty_redemption_rate: 100,
        loyalty_tiers: null,
        loyalty_min_redemption_points: 100,
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
          step_key: 'CONFIGURE_BASIC_INFO',
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante',
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
        kds_audio_enabled: true, table_inactivity_threshold_min: 15, sla_normal_min: 15, sla_special_min: 30,
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
        max_cash_opening_cents: 50000,
        cash_variance_alert_cents: 2000,
        require_denomination_count: false,
        tip_max_untaxed_percent: 10,
        sunat_provider: null,
        sunat_mode: null,
        sunat_sol_user: null,
        sunat_sol_password: null,
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
        sunat_cert_expires_at: null,
        nubefact_token: null,
        nubefact_url: null,
        peru_identity_api_token: null,
        loyalty_enabled: false,
        loyalty_points_per_sol: 1,
        loyalty_redemption_rate: 100,
        loyalty_tiers: null,
        loyalty_min_redemption_points: 100,
        onboarding_status: 'IN_PROGRESS',
        updated_at: new Date(),
      });

      const status = await getOnboardingStatus(tenant_id);

      expect(status).toBe('IN_PROGRESS');
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding for a tenant', async () => {
      vi.mocked(prisma.onboarding_steps.deleteMany).mockResolvedValueOnce({
        count: 6,
      });
      vi.mocked(prisma.tenant_settings.update).mockResolvedValueOnce({
        tenant_id,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: 'Test Address',
        logo_url: null,
        timezone: 'America/Lima',
        currency: 'PEN',
        receipt_footer_text: null,
        kds_audio_enabled: true, table_inactivity_threshold_min: 15, sla_normal_min: 15, sla_special_min: 30,
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
        max_cash_opening_cents: 50000,
        cash_variance_alert_cents: 2000,
        require_denomination_count: false,
        tip_max_untaxed_percent: 10,
        sunat_provider: null,
        sunat_mode: null,
        sunat_sol_user: null,
        sunat_sol_password: null,
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
        sunat_cert_expires_at: null,
        nubefact_token: null,
        nubefact_url: null,
        peru_identity_api_token: null,
        loyalty_enabled: false,
        loyalty_points_per_sol: 1,
        loyalty_redemption_rate: 100,
        loyalty_tiers: null,
        loyalty_min_redemption_points: 100,
        onboarding_status: 'IN_PROGRESS',
        updated_at: new Date(),
      });

      // Mock createMany + findMany for re-creating checklist
      const mockSteps = ONBOARDING_STEPS.map((stepDef) => ({
        id: randomUUID(),
        tenant_id,
        step_number: stepDef.step_number,
        step_key: stepDef.step_key,
        title: stepDef.title,
        description: stepDef.description,
        is_required: stepDef.is_required,
        is_completed: false,
        completed_at: null,
        completed_by: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      }));

      vi.mocked(prisma.onboarding_steps.createMany).mockResolvedValueOnce({
        count: 6,
      });
      vi.mocked(prisma.onboarding_steps.findMany).mockResolvedValueOnce(
        mockSteps
      );

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
      expect(prisma.onboarding_steps.createMany).toHaveBeenCalledTimes(1);
    });
  });
});
