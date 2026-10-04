-- Email/password authentication is optional so Google-only and seeded users remain valid.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
