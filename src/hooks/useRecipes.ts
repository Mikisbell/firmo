/**
 * Hooks SWR para gestión de recetas
 */

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error al cargar recetas' }));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.json();
};

interface UseRecipesOptions {
  page?: number;
  limit?: number;
  category?: string;
  station?: string;
  is_active?: boolean;
}

export function useRecipes(options: UseRecipesOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.category) params.set('category', options.category);
  if (options.station) params.set('station', options.station);
  if (options.is_active !== undefined) params.set('is_active', String(options.is_active));

  const query = params.toString();
  const key = `/api/admin/recipes${query ? `?${query}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  return {
    recipes: data?.data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    error,
    mutate,
  };
}

export function useRecipe(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/admin/recipes/${id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    recipe: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
