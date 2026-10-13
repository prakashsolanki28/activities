import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  MONGO_URL: z.string().min(1).default('mongodb://127.0.0.1:27017/hrrl_activities'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  UPLOAD_DIR: z.string().default('./uploads'),
  ADMIN_EMAIL: z.string().default('admin@hrrl.local'),
  ADMIN_PASSWORD: z.string().default('ChangeMe-2026!'),
  ADMIN_NAME: z.string().default('CISO Office'),
  TRUST_PROXY: z.coerce.number().int().default(1),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function appConfig(): AppConfig {
  if (!cached) {
    const parsed = envSchema.parse(process.env);
    if (parsed.NODE_ENV === 'production' && parsed.JWT_SECRET.startsWith('dev-only')) {
      throw new Error('JWT_SECRET must be set in production');
    }
    cached = parsed;
  }
  return cached;
}

/** Grace period after a deadline before answers are refused (network latency). */
export const DEADLINE_GRACE_MS = 10_000;
export const DISPLAY_TZ = 'Asia/Kolkata';
