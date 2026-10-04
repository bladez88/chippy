import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { CoreStore, store as memoryStore } from './core.store.js'
import { PrismaStore } from './prisma.store.js'
import type { ChippyStore } from './store.js'

export const store: ChippyStore = env.NODE_ENV === 'test' || env.DATA_STORE === 'memory'
  ? memoryStore
  : new PrismaStore(prisma)

export const storeKind = store instanceof CoreStore ? 'memory' : 'prisma'
