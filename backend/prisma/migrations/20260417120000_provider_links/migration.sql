-- AlterTable
ALTER TABLE "users" DROP COLUMN "authProvider",
DROP COLUMN "providerId",
ADD COLUMN "googleId" TEXT,
ADD COLUMN "appleId" TEXT;

-- DropEnum
DROP TYPE "auth_provider";

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId");
