'use client';

import { useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

/**
 * Syncs a single state value with a URL query parameter.
 * Uses Next.js useSearchParams + useRouter for navigation without full reload.
 */
export function useQueryState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = (searchParams.get(key) as T) ?? defaultValue;

  const setValue = useCallback(
    (newValue: T) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newValue === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, newValue);
      }

      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [searchParams, router, pathname, key, defaultValue],
  );

  return [value, setValue];
}

/**
 * Syncs multiple state values with URL query parameters at once.
 * Batches updates into a single URL change.
 */
export function useQueryStates<T extends Record<string, string>>(
  defaults: T,
): [T, (updates: Partial<T>) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = {} as T;
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    values[key] = (searchParams.get(key as string) as T[keyof T]) ?? defaults[key];
  }

  const setValues = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, val] of Object.entries(updates)) {
        if (val === defaults[key as keyof T]) {
          params.delete(key);
        } else {
          params.set(key, val as string);
        }
      }

      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [searchParams, router, pathname, defaults],
  );

  return [values, setValues];
}
