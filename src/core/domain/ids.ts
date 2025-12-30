// src/core/domain/ids.ts
export type UUID = string & { readonly __brand: "UUID" };

export function newUUID(): UUID {
    // Browser safe
    return crypto.randomUUID() as UUID;
}
