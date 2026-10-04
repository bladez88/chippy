import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './database/prisma.js'

const server = app.listen(env.API_PORT, () => console.log(`Chippy API listening on http://localhost:${env.API_PORT}`))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)) })
})
