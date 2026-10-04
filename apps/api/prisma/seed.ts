import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { DateTime } from 'luxon'

const prisma = new PrismaClient()
const zone = 'America/Vancouver'
const tomorrow = DateTime.now().setZone(zone).plus({ days: 1 }).startOf('day')

async function setGeography(tripId: string) {
  await prisma.$executeRaw`
    UPDATE "Trip"
    SET "originGeog" = ST_SetSRID(ST_MakePoint("originLng", "originLat"), 4326)::geography,
        "destinationGeog" = ST_SetSRID(ST_MakePoint("destinationLng", "destinationLat"), 4326)::geography
    WHERE id = ${tripId}
  `
}

async function main() {
  await prisma.user.upsert({
    where: { id: 'user-jimmy' },
    update: { email: 'jimmy@chippy.local', name: 'Jimmy', timezone: zone },
    create: { id: 'user-jimmy', email: 'jimmy@chippy.local', name: 'Jimmy', timezone: zone },
  })
  await prisma.user.upsert({
    where: { id: 'user-daniel' },
    update: { email: 'daniel@chippy.local', name: 'Daniel', timezone: zone },
    create: { id: 'user-daniel', email: 'daniel@chippy.local', name: 'Daniel', timezone: zone },
  })
  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: 'user-jimmy', addresseeId: 'user-daniel' } },
    update: { status: 'ACCEPTED' },
    create: { id: 'friend-demo', requesterId: 'user-jimmy', addresseeId: 'user-daniel', status: 'ACCEPTED' },
  })

  await prisma.trip.upsert({
    where: { id: 'trip-jimmy' },
    update: {
      departureAt: tomorrow.set({ hour: 8, minute: 30 }).toUTC().toJSDate(),
      carpoolStatus: 'LOOKING_FOR_RIDE',
    },
    create: {
      id: 'trip-jimmy', userId: 'user-jimmy', originLabel: 'Home', originAddress: 'Burnaby, BC', originLat: 49.2488, originLng: -122.9805,
      destinationLabel: 'SFU', destinationAddress: '8888 University Dr', destinationLat: 49.2781, destinationLng: -122.9199,
      departureAt: tomorrow.set({ hour: 8, minute: 30 }).toUTC().toJSDate(), timezone: zone, transportationMode: 'TRANSIT', carpoolStatus: 'LOOKING_FOR_RIDE',
    },
  })
  await prisma.trip.upsert({
    where: { id: 'trip-daniel' },
    update: {
      departureAt: tomorrow.set({ hour: 8, minute: 20 }).toUTC().toJSDate(),
      carpoolStatus: 'OFFERING_RIDE', availableSeats: 3,
    },
    create: {
      id: 'trip-daniel', userId: 'user-daniel', originLabel: 'Daniel’s neighbourhood', originAddress: 'Burnaby, BC', originLat: 49.2512, originLng: -122.975,
      destinationLabel: 'SFU', destinationAddress: '8888 University Dr', destinationLat: 49.2781, destinationLng: -122.9199,
      departureAt: tomorrow.set({ hour: 8, minute: 20 }).toUTC().toJSDate(), timezone: zone, transportationMode: 'DRIVING', carpoolStatus: 'OFFERING_RIDE', availableSeats: 3,
    },
  })
  await Promise.all([setGeography('trip-jimmy'), setGeography('trip-daniel')])
  console.log(`Seeded Jimmy and Daniel with trips on ${tomorrow.toISODate()}.`)
}

main().finally(() => prisma.$disconnect())
