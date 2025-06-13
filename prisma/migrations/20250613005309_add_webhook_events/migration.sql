/*
  Warnings:

  - Made the column `phone` on table `Address` required. This step will fail if there are existing NULL values in that column.
  - Made the column `country` on table `BillingAddress` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `BillingAddress` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `BillingAddress` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable
ALTER TABLE "BillingAddress" ALTER COLUMN "country" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
