import { randomUUID } from 'crypto';

export interface OnboardingStep {
  id: string;
  tenant_id: string;
  step_number: number;
  step_key: string;
  title: string;
  description?: string;
  is_required: boolean;
  is_completed: boolean;
  completed_at?: Date;
  completed_by?: string;
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

// Define the standard onboarding steps
const STANDARD_ONBOARDING_STEPS = [
  {
    step_number: 1,
    step_key: 'CONFIGURE_BASIC_INFO',
    title: 'Configure Basic Information',
    description: 'Set up your restaurant name, RUC, and address',
    is_required: true,
  },
  {
    step_number: 2,
    step_key: 'CONFIGURE_SETTINGS',
    title: 'Configure Settings',
    description: 'Set timezone, currency, and other preferences',
    is_required: true,
  },
  {
    step_number: 3,
    step_key: 'CREATE_TERMINAL',
    title: 'Create First Terminal',
    description: 'Set up your first POS terminal',
    is_required: true,
  },
  {
    step_number: 4,
    step_key: 'CREATE_EMPLOYEE',
    title: 'Create First Employee',
    description: 'Add your first employee with PIN',
    is_required: true,
  },
  {
    step_number: 5,
    step_key: 'CREATE_PRODUCT',
    title: 'Create First Product',
    description: 'Add your first product to the catalog',
    is_required: true,
  },
  {
    step_number: 6,
    step_key: 'CONFIGURE_STATIONS',
    title: 'Configure Stations',
    description: 'Set up kitchen stations (Parrilla, Cocina, Bar, etc.)',
    is_required: false,
  },
  {
    step_number: 7,
    step_key: 'CONFIGURE_PAYMENT_METHODS',
    title: 'Configure Payment Methods',
    description: 'Set up accepted payment methods',
    is_required: false,
  },
];

/**
 * Create onboarding checklist for a new tenant
 * Requirements: 13.1, 13.2
 * 
 * NOTE: This function requires the onboarding_steps table to be created via migration.
 * Run: npx prisma db push
 */
export async function createOnboardingChecklist(
  tenant_id: string
): Promise<OnboardingChecklist> {
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
}

/**
 * Get onboarding checklist for a tenant
 * Requirements: 13.1, 13.6
 */
export async function getOnboardingChecklist(
  tenant_id: string
): Promise<OnboardingChecklist> {
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
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
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
}

/**
 * Mark a step as incomplete (for rollback scenarios)
 * Requirements: 13.3
 */
export async function uncompleteOnboardingStep(
  tenant_id: string,
  step_key: string
): Promise<OnboardingStep> {
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
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
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
}

/**
 * Mark onboarding as complete in tenant_settings
 * Requirements: 13.7
 */
export async function markOnboardingComplete(tenant_id: string): Promise<void> {
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
}

/**
 * Get onboarding status for a tenant
 * Requirements: 13.1
 */
export async function getOnboardingStatus(
  tenant_id: string
): Promise<'IN_PROGRESS' | 'COMPLETED'> {
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
}

/**
 * Reset onboarding for a tenant (for testing or re-onboarding)
 * Requirements: 13.3
 */
export async function resetOnboarding(tenant_id: string): Promise<void> {
  // TODO: Implement after migration is applied
  throw new Error('Onboarding feature requires database migration. Run: npx prisma db push');
}
