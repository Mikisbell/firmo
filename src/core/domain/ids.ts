// src/core/domain/ids.ts
import { v4 as uuidv4 } from 'uuid';

export type UUID = string & { readonly __brand: "UUID" };

export function newUUID(): UUID {
    // Browser safe
    return uuidv4() as UUID;
}
