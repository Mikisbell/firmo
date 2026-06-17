// src/core/catalog/service.ts
// Catalog versioning service for offline-first POS

import { db } from "@/src/core/db/schema";
import type { Centavos } from "@/src/core/types/shared";

export interface CatalogItem {
    id: string;
    sku: string;
    name: string;
    short_name?: string;
    price_cents: Centavos;
    category: string;
    station: string;
    active: boolean;
}

export interface CatalogSnapshot {
    version: number;
    checksum: string;
    updated_at: string;
    items: CatalogItem[];
}

// Fetch catalog from API
export async function fetchLatestCatalog(): Promise<CatalogSnapshot> {
    const res = await fetch("/api/catalog/latest");
    if (!res.ok) throw new Error("Failed to fetch catalog");
    return res.json();
}

// Save catalog to local Dexie cache
export async function saveCatalogToLocal(catalog: CatalogSnapshot): Promise<void> {
    const storeId = "default"; // MVP: single store

    await db.transaction("rw", db.catalog_versions, db.catalog_items, async () => {
        // Deactivate old versions
        await db.catalog_versions
            .where("active")
            .equals(1)
            .modify({ active: false });

        // Save new version
        await db.catalog_versions.add({
            tenant_id: storeId, // Using generic ID for now (MVP single tenant)
            version: catalog.version,
            checksum: catalog.checksum,
            active: true,
            created_at: catalog.updated_at,
        });

        // Clear and add new items
        await db.catalog_items.clear();
        for (const item of catalog.items) {
            await db.catalog_items.add({
                id: item.id,
                tenant_id: storeId,
                product_id: item.id,
                name: item.name,
                price_cents: item.price_cents,
                tax_rate: 0.18, // IGV Peru
                category: item.category,
                station: item.station,
                sku: item.sku,
        is_special_sla: false,
            });
        }
    });
}

// Load catalog from local cache
export async function loadCatalogFromLocal(): Promise<CatalogItem[]> {
    const { unsafeCentavos } = await import("@/src/core/types/shared");
    const items = await db.catalog_items.toArray();

    // Transform to CatalogItem format
    return items.map(item => ({
        id: item.id,
        sku: item.product_id,
        name: item.name,
        short_name: undefined,
        price_cents: unsafeCentavos(item.price_cents),
        category: "general",
        station: "COCINA",
        active: true,
    }));
}

// Get current catalog version
export async function getCurrentCatalogVersion(): Promise<number | null> {
    const active = await db.catalog_versions
        .where("active")
        .equals(1 as any) // Dexie stores boolean as 0/1
        .first();

    return active?.version ?? null;
}

// Verify catalog checksum
export function verifyCatalogChecksum(catalog: CatalogSnapshot, expectedChecksum: string): boolean {
    return catalog.checksum === expectedChecksum;
}

// Sync catalog: fetch from API and save locally
export async function syncCatalog(): Promise<{ updated: boolean; version: number }> {
    const localVersion = await getCurrentCatalogVersion();
    const remote = await fetchLatestCatalog();

    if (localVersion === null || remote.version > localVersion) {
        await saveCatalogToLocal(remote);
        return { updated: true, version: remote.version };
    }

    return { updated: false, version: localVersion };
}
