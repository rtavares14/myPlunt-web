/*
  Warnings:

  - The `status` column on the `friendships` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sunlight` column on the `plants` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `authProvider` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('LOCAL', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "sunlight" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "friendship_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- DropForeignKey
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_addresseeId_fkey";

-- DropForeignKey
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "planters" DROP CONSTRAINT "planters_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "plants" DROP CONSTRAINT "plants_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "user_blocks" DROP CONSTRAINT "user_blocks_blockedId_fkey";

-- DropForeignKey
ALTER TABLE "user_blocks" DROP CONSTRAINT "user_blocks_blockerId_fkey";

-- DropForeignKey
ALTER TABLE "watering_reminders" DROP CONSTRAINT "watering_reminders_plantId_fkey";

-- DropForeignKey
ALTER TABLE "watering_reminders" DROP CONSTRAINT "watering_reminders_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "watering_reminders" DROP CONSTRAINT "watering_reminders_senderId_fkey";

-- AlterTable
ALTER TABLE "friendships" DROP COLUMN "status",
ADD COLUMN     "status" "friendship_status" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "plants" ADD COLUMN     "lastWateredAt" TIMESTAMP(3),
DROP COLUMN "sunlight",
ADD COLUMN     "sunlight" "sunlight" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "authProvider",
ADD COLUMN     "authProvider" "auth_provider" NOT NULL DEFAULT 'LOCAL';

-- DropEnum
DROP TYPE "AuthProvider";

-- DropEnum
DROP TYPE "FriendshipStatus";

-- DropEnum
DROP TYPE "Sunlight";

-- CreateIndex
CREATE INDEX "planters_ownerId_idx" ON "planters"("ownerId");

-- CreateIndex
CREATE INDEX "plants_ownerId_idx" ON "plants"("ownerId");

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planters" ADD CONSTRAINT "planters_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watering_reminders" ADD CONSTRAINT "watering_reminders_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watering_reminders" ADD CONSTRAINT "watering_reminders_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watering_reminders" ADD CONSTRAINT "watering_reminders_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
