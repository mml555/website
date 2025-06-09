/*
  Warnings:

  - You are about to drop the column `address` on the `BillingAddress` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `BillingAddress` table. All the data in the column will be lost.
  - Added the required column `postalCode` to the `BillingAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `BillingAddress` table without a default value. This is not possible if the table is not empty.

*/
-- First, add the new columns as nullable
ALTER TABLE "BillingAddress" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "BillingAddress" ADD COLUMN "street" TEXT;

-- Copy data from old columns to new columns
UPDATE "BillingAddress" SET "postalCode" = "zipCode";
UPDATE "BillingAddress" SET "street" = "address";

-- Make the new columns required
ALTER TABLE "BillingAddress" ALTER COLUMN "postalCode" SET NOT NULL;
ALTER TABLE "BillingAddress" ALTER COLUMN "street" SET NOT NULL;

-- Drop the old columns
ALTER TABLE "BillingAddress" DROP COLUMN "address";
ALTER TABLE "BillingAddress" DROP COLUMN "zipCode";
