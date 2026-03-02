import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { ONBOARDING_STEPS, type OnboardingStepKey } from './onboarding-steps';

export { ONBOARDING_STEPS, type OnboardingStepKey } from './onboarding-steps';

export interface OnboardingStep {
  id: string;
  tenant_id: string;
  step_number: number;
  step_key: string;
  title: string;
  description: string | null;
  is_required: boolean;
  is_completed: boolean;
  completed_at: Date | null;
  completed_by: string | null;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
}

export interface OnboardingChecklist {
  tenant_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  steps: OnboardingStep[];
  completion_percentage: number;
}

/**
 * Prisma client type that works both standalone and inside a transaction.
 * Accepts PrismaClient or Prisma.TransactionClient.
 */
type PrismaTransaction = PrismaClient | Prisma.TransactionClient;

/**
 * Calculate completion percentage from steps
 */
function calculateCompletionPercentage(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 0;
  const completed = steps.filter((s) => s.is_completed).length;
  return Math.round((completed / steps.length) * 100);
}

/**
 * Determine status from steps
 */
function determineStatus(steps: OnboardingStep[]): 'IN_PROGRESS' | 'COMPLETED' {
  const allRequiredDone = steps
    .filter((s) => s.is_required)
    .every((s) => s.is_completed);
  return allRequiredDone && steps.some((s) => s.is_completed)
    ? 'COMPLETED'
    : 'IN_PROGRESS';
}

/**
 * Create onboarding checklist for a new tenant.
 * Accepts optional tx parameter for transactional usage (e.g., inside provisionTenant).
 * If no tx is provided, uses the prisma singleton (backward compatible).
 *
 * Requirements: 13.1, 13.2, F1.1, F1.4
 */
export async function createOnboardingChecklist(
  tenant_id: string,
  tx?: PrismaTransaction
): Promise<OnboardingChecklist> {
  const client = tx || prisma;

  // Batch insert all steps in a single query for performance
  const stepData = ONBOARDING_STEPS.map((stepDef) => ({
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
  }));

  await client.onboarding_steps.createMany({
    data: stepData,
  });

  // Fetch the created steps to return full objects with DB defaults
  const steps = await client.onboarding_steps.findMany({
    where: { tenant_id },
    orderBy: { step_number: 'asc' },
  });

  return {
    tenant_id,
    status: 'IN_PROGRESS',
    steps,
    completion_percentage: 0,
  };
}

/**
 * Get onboarding checklist for a tenant
 * Requirements: 13.1, 13.6
 */
export async function getOnboardingChecklist(
  tenant_id: string
): Promise<OnboardingChecklist> {
  const steps = await prisma.onboarding_steps.findMany({
    where: { tenant_id },
    orderBy: { step_number: 'asc' },
  });

  if (!steps || steps.length === 0) {
    throw new Error('Onboarding checklist not found');
  }

  const completion_percentage = calculateCompletionPercentage(steps);
  const status = determineStatus(steps);

  return {
    tenant_id,
    status,
    steps,
    completion_percentage,
  };
}

/**
 * Mark a step as completed
 * Requirements: 13.3, 13.4
 */
export async function completeOnboardingStep(
  tenant_id: string,
  step_key: string,
  completed_by?: string
): Promise<OnboardingStep> {
  const step = await prisma.onboarding_steps.findUnique({
    where: {
      tenant_id_step_key: { tenant_id, step_key },
    },
  });

  if (!step) {
    throw new Error(`Onboarding step ${step_key} not found`);
  }

  const updatedStep = await prisma.onboarding_steps.update({
    where: {
      tenant_id_step_key: { tenant_id, step_key },
    },
    data: {
      is_completed: true,
      completed_at: new Date(),
      completed_by: completed_by || null,
    },
  });

  return updatedStep;
}

/**
 * Mark a step as incomplete (for rollback scenarios)
 * Requirements: 13.3
 */
export async function uncompleteOnboardingStep(
  tenant_id: string,
  step_key: string
): Promise<OnboardingStep> {
  const step = await prisma.onboarding_steps.findUnique({
    where: {
      tenant_id_step_key: { tenant_id, step_key },
    },
  });

  if (!step) {
    throw new Error(`Onboarding step ${step_key} not found`);
  }

  const updatedStep = await prisma.onboarding_steps.update({
    where: {
      tenant_id_step_key: { tenant_id, step_key },
    },
    data: {
      is_completed: false,
      completed_at: null,
      completed_by: null,
    },
  });

  return updatedStep;
}

/**
 * Validate onboarding is complete
 * Requirements: 13.5, 13.6
 */
export async function validateOnboardingComplete(
  tenant_id: string
): Promise<{
  is_complete: boolean;
  missing_steps: string[];
  completion_percentage: number;
}> {
  const steps = await prisma.onboarding_steps.findMany({
    where: { tenant_id },
    orderBy: { step_number: 'asc' },
  });

  const requiredSteps = (steps || []).filter((s: OnboardingStep) => s.is_required);
  const incompleteRequired = requiredSteps.filter(
    (s: OnboardingStep) => !s.is_completed
  );
  const missing_steps = incompleteRequired.map((s: OnboardingStep) => s.step_key);

  const completion_percentage = calculateCompletionPercentage(steps || []);

  return {
    is_complete: incompleteRequired.length === 0,
    missing_steps,
    completion_percentage,
  };
}

/**
 * Mark onboarding as complete in tenant_settings
 * Requirements: 13.7
 */
export async function markOnboardingComplete(tenant_id: string): Promise<void> {
  const validation = await validateOnboardingComplete(tenant_id);

  if (!validation.is_complete) {
    throw new Error(
      `Cannot mark onboarding complete: missing steps: ${validation.missing_steps.join(', ')}`
    );
  }

  await prisma.tenant_settings.update({
    where: { tenant_id },
    data: {
      onboarding_status: 'COMPLETED',
    },
  });
}

/**
 * Get onboarding status for a tenant
 * Requirements: 13.1
 */
export async function getOnboardingStatus(
  tenant_id: string
): Promise<'IN_PROGRESS' | 'COMPLETED'> {
  const settings = await prisma.tenant_settings.findUnique({
    where: { tenant_id },
  });

  if (!settings) {
    throw new Error('Tenant not found');
  }

  return (settings.onboarding_status as 'IN_PROGRESS' | 'COMPLETED') || 'IN_PROGRESS';
}

/**
 * Reset onboarding for a tenant (for testing or re-onboarding)
 * Requirements: 13.3
 */
export async function resetOnboarding(tenant_id: string): Promise<void> {
  // Delete existing steps
  await prisma.onboarding_steps.deleteMany({
    where: { tenant_id },
  });

  // Reset status in tenant_settings
  await prisma.tenant_settings.update({
    where: { tenant_id },
    data: {
      onboarding_status: 'IN_PROGRESS',
    },
  });

  // Re-create checklist
  await createOnboardingChecklist(tenant_id);
}
