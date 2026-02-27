/**
 * POST /api/admin/tenants/provision
 * 
 * Provision a new tenant with all required resources.
 * 
 * Requirements: 3.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { provisionTenant } from '@/src/core/tenant/provisioning';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';

// Validation schema
const ProvisioningRequestSchema = z.object({
  legal_name: z.string().min(1, 'Legal name is required'),
  ruc: z.string().optional(),
  address_text: z.string().optional(),
  admin_name: z.string().min(1, 'Admin name is required'),
  admin_pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
  timezone: z.string().optional().default('America/Lima'),
  currency: z.string().optional().default('PEN'),
  receipt_footer_text: z.string().optional(),
  kds_audio_enabled: z.boolean().optional().default(true),
  kds_audio_volume: z.number().min(0).max(100).optional().default(50),
  default_delivery_fee_cents: z.number().min(0).optional().default(0),
  enable_tips: z.boolean().optional().default(true),
  tips_on_invoice: z.boolean().optional().default(false),
  allow_offline_coupon: z.boolean().optional().default(true),
  max_offline_coupons_per_order: z.number().min(1).optional().default(5),
  require_manager_for_offline: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.employeeId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin access
    const context = await withCrossTenantAdmin(
      session.employeeId,
      '', // No specific tenant for provisioning
      'can_modify_configuration',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Parse and validate request body
    const body = await request.json();
    const validatedData = ProvisioningRequestSchema.parse(body);

    // Provision tenant
    const result = await provisionTenant(validatedData);

    // Log action
    await logCrossTenantAdminAction(
      context,
      'PROVISION_TENANT',
      'tenants',
      result.tenant_id,
      {
        legal_name: validatedData.legal_name,
        admin_name: validatedData.admin_name,
      }
    );

    return NextResponse.json({
      success: true,
      tenant_id: result.tenant_id,
      admin_employee_id: result.admin_employee_id,
      activation_code: result.activation_code,
      credentials: result.credentials,
      onboarding_checklist: result.onboarding_checklist,
    });
  } catch (error: any) {
    console.error('Error provisioning tenant:', error instanceof Error ? error.message : String(error));

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
