import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('development-secret-change-me'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().optional(),
  OPENROUTESERVICE_API_KEY: z.string().optional(),
  ENABLE_DEV_AUTH: z.string().default('true').transform((value) => value === 'true'),
  ROUTING_PROVIDER: z.enum(['mock', 'ors']).default('mock'),
  DATA_STORE: z.enum(['memory', 'prisma']).default('memory'),
  DATABASE_URL: z.string().optional(),
})
export const env = schema.parse(process.env)
if (env.NODE_ENV === 'production' && env.ENABLE_DEV_AUTH) throw new Error('Development authentication cannot be enabled in production')
if (env.DATA_STORE === 'prisma' && !env.DATABASE_URL) throw new Error('DATABASE_URL is required when DATA_STORE=prisma')
