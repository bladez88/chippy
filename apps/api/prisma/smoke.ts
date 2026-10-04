import 'dotenv/config'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [database] = await prisma.$queryRaw<Array<{ database: string; postgis: string }>>`
    SELECT current_database() AS database, PostGIS_Version() AS postgis
  `
  const [distance] = await prisma.$queryRaw<Array<{ meters: number }>>`
    SELECT ST_Distance(a."destinationGeog", b."destinationGeog") AS meters
    FROM "Trip" a, "Trip" b
    WHERE a.id = 'trip-jimmy' AND b.id = 'trip-daniel'
  `
  const [users, trips, friendships] = await Promise.all([
    prisma.user.count({ where: { id: { in: ['user-jimmy', 'user-daniel'] } } }),
    prisma.trip.count({ where: { id: { in: ['trip-jimmy', 'trip-daniel'] } } }),
    prisma.friendship.count({ where: { requesterId: 'user-jimmy', addresseeId: 'user-daniel', status: 'ACCEPTED' } }),
  ])
  assert.equal(users, 2)
  assert.equal(trips, 2)
  assert.equal(friendships, 1)
  assert.equal(distance?.meters, 0)
  console.log(JSON.stringify({ database: database?.database, postgis: database?.postgis, users, trips, acceptedFriendships: friendships, destinationDistanceMeters: distance?.meters }))
}

main().finally(() => prisma.$disconnect())
