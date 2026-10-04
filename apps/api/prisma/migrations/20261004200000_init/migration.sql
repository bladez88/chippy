-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "TransportationMode" AS ENUM ('DRIVING', 'TRANSIT', 'WALKING', 'CYCLING');

-- CreateEnum
CREATE TYPE "CarpoolStatus" AS ENUM ('NONE', 'LOOKING_FOR_RIDE', 'OFFERING_RIDE', 'REQUEST_PENDING', 'MATCHED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RideRequestType" AS ENUM ('RIDE_REQUEST', 'RIDE_OFFER');

-- CreateEnum
CREATE TYPE "RideRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('DRIVER', 'PASSENGER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RIDE_REQUEST', 'RIDE_OFFER', 'RIDE_ACCEPTED', 'RIDE_DECLINED', 'CARPOOL_CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Vancouver',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originLabel" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "originGeog" geography(Point,4326),
    "destinationLabel" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "destinationLat" DOUBLE PRECISION NOT NULL,
    "destinationLng" DOUBLE PRECISION NOT NULL,
    "destinationGeog" geography(Point,4326),
    "departureTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "daysOfWeek" INTEGER[],
    "transportationMode" "TransportationMode" NOT NULL,
    "carpoolStatus" "CarpoolStatus" NOT NULL DEFAULT 'NONE',
    "availableSeats" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT,
    "userId" TEXT NOT NULL,
    "originLabel" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "originGeog" geography(Point,4326),
    "destinationLabel" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "destinationLat" DOUBLE PRECISION NOT NULL,
    "destinationLng" DOUBLE PRECISION NOT NULL,
    "destinationGeog" geography(Point,4326),
    "departureAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "estimatedArrivalAt" TIMESTAMP(3),
    "transportationMode" "TransportationMode" NOT NULL,
    "carpoolStatus" "CarpoolStatus" NOT NULL DEFAULT 'NONE',
    "availableSeats" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideRequest" (
    "id" TEXT NOT NULL,
    "driverTripId" TEXT NOT NULL,
    "passengerTripId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestType" "RideRequestType" NOT NULL,
    "status" "RideRequestStatus" NOT NULL DEFAULT 'PENDING',
    "fuelContributionAmount" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carpool" (
    "id" TEXT NOT NULL,
    "driverTripId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "pickupLabel" TEXT,
    "pickupAddress" TEXT,
    "pickupLat" DOUBLE PRECISION,
    "pickupLng" DOUBLE PRECISION,
    "estimatedDriverDetourMinutes" INTEGER,
    "fuelContributionAmount" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Carpool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarpoolParticipant" (
    "carpoolId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL,

    CONSTRAINT "CarpoolParticipant_pkey" PRIMARY KEY ("carpoolId","tripId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "referenceId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "Trip_userId_departureAt_idx" ON "Trip"("userId", "departureAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_scheduleId_departureAt_key" ON "Trip"("scheduleId", "departureAt");

-- CreateIndex
CREATE INDEX "RideRequest_driverTripId_status_idx" ON "RideRequest"("driverTripId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Carpool_driverTripId_key" ON "Carpool"("driverTripId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_driverTripId_fkey" FOREIGN KEY ("driverTripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_passengerTripId_fkey" FOREIGN KEY ("passengerTripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carpool" ADD CONSTRAINT "Carpool_driverTripId_fkey" FOREIGN KEY ("driverTripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolParticipant" ADD CONSTRAINT "CarpoolParticipant_carpoolId_fkey" FOREIGN KEY ("carpoolId") REFERENCES "Carpool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolParticipant" ADD CONSTRAINT "CarpoolParticipant_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolParticipant" ADD CONSTRAINT "CarpoolParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Spatial indexes used by destination matching and future pickup-radius queries.
CREATE INDEX "Schedule_originGeog_gix" ON "Schedule" USING GIST ("originGeog");
CREATE INDEX "Schedule_destinationGeog_gix" ON "Schedule" USING GIST ("destinationGeog");
CREATE INDEX "Trip_originGeog_gix" ON "Trip" USING GIST ("originGeog");
CREATE INDEX "Trip_destinationGeog_gix" ON "Trip" USING GIST ("destinationGeog");
