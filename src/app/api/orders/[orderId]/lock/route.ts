// src/app/api/orders/[orderId]/lock/route.ts
// Endpoint de bloqueo suave para edición de órdenes
// Verificar, adquirir, liberar y renovar bloqueos suaves

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/core/db/prisma";
import {
  checkSoftLock,
  acquireSoftLock,
  releaseSoftLock,
  renewSoftLock,
} from "@/src/core/conflict/soft-lock.service";
import { requirePosAuth } from "@/src/core/middleware/pos-auth";

// GET /api/orders/{orderId}/lock - Verificar estado del bloqueo
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requirePosAuth(req);
  if (!authResult.authorized) return authResult.response;

  const { orderId } = await params;
  const tenantId = authResult.user.tenantId;
  const terminalId = req.nextUrl.searchParams.get("terminal_id");

  if (!terminalId) {
    return NextResponse.json(
      { error: "Falta terminal_id" },
      { status: 400 }
    );
  }

  const lockInfo = await checkSoftLock(prisma, tenantId, "ORDER", orderId, terminalId);

  return NextResponse.json(lockInfo);
}

// POST /api/orders/{orderId}/lock - Adquirir o renovar bloqueo
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requirePosAuth(req);
  if (!authResult.authorized) return authResult.response;

  const { orderId } = await params;
  const tenantId = authResult.user.tenantId;

  let body: { terminal_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { terminal_id, action = "acquire" } = body;

  if (!terminal_id) {
    return NextResponse.json(
      { error: "Falta terminal_id" },
      { status: 400 }
    );
  }

  if (action === "renew") {
    const renewed = await renewSoftLock(prisma, tenantId, "ORDER", orderId, terminal_id);
    return NextResponse.json({ renewed });
  }

  // Por defecto: adquirir
  const result = await acquireSoftLock(prisma, tenantId, "ORDER", orderId, terminal_id);
  return NextResponse.json(result);
}

// DELETE /api/orders/{orderId}/lock - Liberar bloqueo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requirePosAuth(req);
  if (!authResult.authorized) return authResult.response;

  const { orderId } = await params;
  const tenantId = authResult.user.tenantId;
  const terminalId = req.nextUrl.searchParams.get("terminal_id");

  if (!terminalId) {
    return NextResponse.json(
      { error: "Falta terminal_id" },
      { status: 400 }
    );
  }

  const released = await releaseSoftLock(prisma, tenantId, "ORDER", orderId, terminalId);
  return NextResponse.json({ released });
}
