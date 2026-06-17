import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { ingestRequestSchema } from "@/src/core/domain/events";
import { handleCorsPreflightRequest, addCorsHeaders } from "@/src/lib/cors-helpers";
import { jwtVerify, type JWTPayload } from 'jose';

// Despliegue optimizado para Cloudflare Edge (V8 Isolate)
export const runtime = "edge";
export const dynamic = "force-dynamic";

// Inicializar cliente ligero de Supabase (Zero-TCP, 100% HTTP Fetch)
// Usamos el SERVICE_ROLE porque este endpoint es backend (Edge).
// RLS se bypassa, PERO la seguridad se garantiza forzando el tenant_id 
// desde el JWT verificado nativamente con jose.
function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const JWT_ISSUER = 'park-pos';
const JWT_AUDIENCE = 'park-pos-client';

export async function OPTIONS(req: Request) {
    const origin = req.headers.get('origin');
    return handleCorsPreflightRequest(origin);
}

export async function POST(req: Request) {
    // 1. Validación de Identidad (JWT Edge Native)
    // SRE Ruta A: Extraemos el token de la cookie HttpOnly o del header Authorization
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
        const cookieHeader = req.headers.get('cookie');
        if (cookieHeader) {
            const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
            if (match) {
                token = match[1];
            }
        }
    }
    
    if (!token) {
        return addCorsHeaders(NextResponse.json(
            { accepted: false, error: "UNAUTHORIZED" },
            { status: 401 }
        ), req.headers.get('origin') || undefined);
    }

    let jwtPayload: JWTPayload;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        jwtPayload = payload;
    } catch (e) {
        return addCorsHeaders(NextResponse.json(
            { accepted: false, error: "UNAUTHORIZED" },
            { status: 401 }
        ), req.headers.get('origin') || undefined);
    }
    
    // Extraemos el tenant y el actor directamente del token Criptográfico.
    // Esto es inyectable y no puede ser falsificado por el cliente.
    const secureTenantId = jwtPayload.tid as string;
    const secureActorId = jwtPayload.sub as string;

    // 2. Parseo Ultraligero
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return addCorsHeaders(NextResponse.json(
            { accepted: false, error: "INVALID_JSON" },
            { status: 400 }
        ), req.headers.get('origin') || undefined);
    }

    const result = ingestRequestSchema.safeParse(body);
    if (!result.success) {
        return addCorsHeaders(NextResponse.json(
            { accepted: false, error: "SCHEMA_VALIDATION_FAILED", details: result.error.errors },
            { status: 400 }
        ), req.headers.get('origin') || undefined);
    }

    const { events, to_terminal_sequence } = result.data;

    // Fast path: Lote vacío
    if (events.length === 0) {
        return addCorsHeaders(NextResponse.json(
            { accepted: true, acked_through_terminal_sequence: to_terminal_sequence },
            { status: 200 }
        ), req.headers.get('origin') || undefined);
    }

    // 3. Mapear a esquema de base de datos puro + FORZAR SEGURIDAD (Override)
    const mappedEvents = events.map(ev => ({
        id: ev.event_id,
        // SEGURIDAD CRÍTICA: Ignoramos el tenant_id y actor_id del JSON.
        // Los forzamos desde el JWT para evitar ataques de Inyección Cross-Tenant.
        tenant_id: secureTenantId,
        actor_id: secureActorId,
        
        occurred_at: new Date(ev.occurred_at).toISOString(),
        type: ev.event_type,
        entity_type: ev.aggregate_type,
        entity_id: ev.aggregate_id,
        actor_role_snapshot: ev.actor_role_snapshot ?? null,
        terminal_id: ev.terminal_id,
        payload_version: ev.payload_version,
        payload: ev.payload,
    }));

    // 4. "Dumb Pipe" Irrompible: Idempotencia Declarativa
    // Usamos UPSERT con ignoreDuplicates = true.
    // Si un evento ya existe (colisión UUID), Postgres lo descarta en silencio
    // y continúa insertando el resto del lote en la misma transacción. CERO pérdida de datos.
    const { error } = await getSupabaseClient()
        .from('events')
        .upsert(mappedEvents, { 
            onConflict: 'id', 
            ignoreDuplicates: true 
        });

    if (error) {
        // Si hay un error aquí, es una falla de infraestructura real (ej. disco lleno),
        // devolvemos 500 para que el LocalEventStore no borre los eventos y reintente luego.
        console.error(`[EDGE INGEST] Error fatal insertando eventos:`, error);
        return addCorsHeaders(NextResponse.json(
            { accepted: false, error: "DB_ERROR" },
            { status: 500 }
        ), req.headers.get('origin') || undefined);
    }

    // 5. Respuesta en microsegundos (El SRE de base de datos se encarga del resto)
    return addCorsHeaders(NextResponse.json(
        {
            accepted: true,
            acked_through_terminal_sequence: to_terminal_sequence,
        },
        { status: 200 }
    ), req.headers.get('origin') || undefined);
}
