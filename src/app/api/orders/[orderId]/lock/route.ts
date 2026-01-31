// src/app/api/orders/[orderId]/lock/route.ts
// Soft Lock Endpoint for Order Editing
// Check, acquire, release, and renew soft locks

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  checkSoftLock,
  acquireSoftLock,
  releaseSoftLock,
  renewSoftLock,
} from "@/src/core/conflict/soft-lock.service";

const prisma = new PrismaClient();

// GET /api/orders/{orderId}/lock - Check lock status
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");
  const terminalId = url.searchParams.get("terminal_id");

  if (!tenantId || !terminalId) {
    return NextResponse.json(
      { error: "Faltan tenant_id o terminal_id" },
      { status: 400 }
    );
  }

  const lockInfo = await checkSoftLock(prisma, tenantId, "ORDER", orderId, terminalId);

  return NextResponse.json(lockInfo);
}

// POST /api/orders/{orderId}/lock - Acquire or renew lock
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  let body: { tenant_id?: string; terminal_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { tenant_id, terminal_id, action = "acquire" } = body;

  if (!tenant_id || !terminal_id) {
    return NextResponse.json(
      { error: "Faltan tenant_id o terminal_id" },
      { status: 400 }
    );
  }

  if (action === "renew") {
    const renewed = await renewSoftLock(prisma, tenant_id, "ORDER", orderId, terminal_id);
    return NextResponse.json({ renewed });
  }

  // Default: acquire
  const result = await acquireSoftLock(prisma, tenant_id, "ORDER", orderId, terminal_id);
  return NextResponse.json(result);
}

// DELETE /api/orders/{orderId}/lock - Release lock
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");
  const terminalId = url.searchParams.get("terminal_id");

  if (!tenantId || !terminalId) {
    return NextResponse.json(
      { error: "Faltan tenant_id o terminal_id" },
      { status: 400 }
    );
  }

  const released = await releaseSoftLock(prisma, tenantId, "ORDER", orderId, terminalId);
  return NextResponse.json({ released });
}
