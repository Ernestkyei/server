/*
  Warnings:

  - You are about to drop the column `category_id` on the `bundles` table. All the data in the column will be lost.
  - You are about to drop the column `file_url` on the `bundles` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `bundles` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `bundles` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `is_read` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `total_amount` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `downloads` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `dataSize` to the `bundles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `network` to the `bundles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bundle_id` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone_number` on table `orders` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "bundles" DROP CONSTRAINT "bundles_category_id_fkey";

-- DropForeignKey
ALTER TABLE "downloads" DROP CONSTRAINT "downloads_bundle_id_fkey";

-- DropForeignKey
ALTER TABLE "downloads" DROP CONSTRAINT "downloads_order_id_fkey";

-- DropForeignKey
ALTER TABLE "downloads" DROP CONSTRAINT "downloads_user_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_bundle_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_order_id_fkey";

-- DropIndex
DROP INDEX "bundles_slug_key";

-- DropIndex
DROP INDEX "notifications_created_at_idx";

-- DropIndex
DROP INDEX "notifications_is_read_idx";

-- AlterTable
ALTER TABLE "bundles" DROP COLUMN "category_id",
DROP COLUMN "file_url",
DROP COLUMN "image_url",
DROP COLUMN "slug",
ADD COLUMN     "dataSize" TEXT NOT NULL,
ADD COLUMN     "network" TEXT NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "created_at",
DROP COLUMN "data",
DROP COLUMN "is_read",
DROP COLUMN "type",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "total_amount",
ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "bundle_id" TEXT NOT NULL,
ADD COLUMN     "payment_reference" TEXT,
ALTER COLUMN "phone_number" SET NOT NULL;

-- DropTable
DROP TABLE "categories";

-- DropTable
DROP TABLE "downloads";

-- DropTable
DROP TABLE "order_items";

-- DropTable
DROP TABLE "payments";

-- DropEnum
DROP TYPE "NotificationType";

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_payment_reference_idx" ON "orders"("payment_reference");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
