/*
  Warnings:

  - You are about to drop the column `address` on the `UserAddress` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `UserAddress` table. All the data in the column will be lost.
  - Added the required column `postalCode` to the `UserAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `UserAddress` table without a default value. This is not possible if the table is not empty.

*/
-- First, add the new columns as nullable
ALTER TABLE "UserAddress" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "UserAddress" ADD COLUMN "street" TEXT;

-- Copy data from old columns to new columns
UPDATE "UserAddress" SET "postalCode" = "zipCode";
UPDATE "UserAddress" SET "street" = "address";

-- Make the new columns required
ALTER TABLE "UserAddress" ALTER COLUMN "postalCode" SET NOT NULL;
ALTER TABLE "UserAddress" ALTER COLUMN "street" SET NOT NULL;

-- Drop the old columns
ALTER TABLE "UserAddress" DROP COLUMN "address";
ALTER TABLE "UserAddress" DROP COLUMN "zipCode";
