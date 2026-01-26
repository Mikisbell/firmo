/**
 * Prisma Configuration
 * 
 * This file replaces the deprecated package.json#prisma configuration
 * See: https://www.prisma.io/docs/orm/reference/prisma-config-reference
 */

import { defineConfig } from 'prisma/config';

export default defineConfig({
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
