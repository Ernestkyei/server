/*
  Warnings:

  - You are about to drop the column `price` on the `bundles` table. All the data in the column will be lost.
  - Added the required column `costPrice` to the `bundles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `bundles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerCode` to the `bundles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellingPrice` to the `bundles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `bundles` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `network` on the `bundles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING_DELIVERY', 'PROCESSING', 'DELIVERED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Network" AS ENUM ('MTN', 'VODAFONE', 'AIRTELTIGO', 'GLO');

-- AlterTable
ALTER TABLE "bundles" DROP COLUMN "price",
ADD COLUMN     "costPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "providerCode" TEXT NOT NULL,
ADD COLUMN     "sellingPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "validity" INTEGER NOT NULL DEFAULT 30,
DROP COLUMN "network",
ADD COLUMN     "network" "Network" NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
ADD COLUMN     "delivery_message" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "provider_request_id" TEXT,
ADD COLUMN     "provider_status" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "provider_accounts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPayment" TIMESTAMP(3),
    "nextPayment" TIMESTAMP(3),
    "paymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_transactions_account_id_idx" ON "provider_transactions"("account_id");

-- CreateIndex
CREATE INDEX "orders_deliveryStatus_idx" ON "orders"("deliveryStatus");

-- AddForeignKey
ALTER TABLE "provider_transactions" ADD CONSTRAINT "provider_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "provider_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
