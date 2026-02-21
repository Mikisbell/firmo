/**
 * Platform Adapter Factory
 *
 * Creates the correct adapter instance based on platform name.
 *
 * @module core/integrations/platforms/adapter-factory
 */

import type { PlatformName } from '@/src/core/types/platform';
import type { PlatformAdapter } from './platform-adapter';
import { PedidosYaAdapter } from './pedidosya-adapter';
import { LlamaFoodAdapter } from './llamafood-adapter';

const adapters: Record<string, () => PlatformAdapter> = {
  PEDIDOSYA: () => new PedidosYaAdapter(),
  LLAMAFOOD: () => new LlamaFoodAdapter(),
};

export function createPlatformAdapter(platform: PlatformName): PlatformAdapter {
  const factory = adapters[platform];
  if (!factory) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return factory();
}

export function getSupportedPlatforms(): PlatformName[] {
  return Object.keys(adapters) as PlatformName[];
}
