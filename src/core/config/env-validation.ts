import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL cannot be empty')
    .refine(
      (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
      'DATABASE_URL must start with postgresql:// or postgres://',
    ),

  // Security
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters for security'),

  // Environment
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // Redis (optional)
  REDIS_URL: z.string().optional(),

  // API Secret (optional, but min 16 chars if provided)
  PARK_API_SECRET: z
    .string()
    .min(16, 'PARK_API_SECRET must be at least 16 characters if provided')
    .optional(),

  // Sentry (optional)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // Supabase (optional)
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
})

export type EnvConfig = z.infer<typeof envSchema>

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const lines: string[] = ['Environment validation failed:']

    for (const [field, messages] of Object.entries(errors)) {
      if (messages && messages.length > 0) {
        lines.push(`  - ${field}: ${messages.join(', ')}`)
      }
    }

    const message = lines.join('\n')
    console.error(`\n${'='.repeat(60)}\n${message}\n${'='.repeat(60)}\n`)
    throw new Error(message)
  }

  return result.data
}

let _env: EnvConfig | null = null

export const env: EnvConfig = new Proxy({} as EnvConfig, {
  get(_target, prop: string) {
    if (_env === null) {
      _env = validateEnv()
    }
    return _env[prop as keyof EnvConfig]
  },
})
