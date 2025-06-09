/*
  Warnings:

  - Added the required column `email` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- First, add the columns as nullable
ALTER TABLE "Address" ADD COLUMN "name" TEXT;
ALTER TABLE "Address" ADD COLUMN "email" TEXT;
ALTER TABLE "Address" ADD COLUMN "phone" TEXT;

-- Update existing records with values from billing addresses
UPDATE "Address" a
SET 
  name = ba.name,
  email = ba.email,
  phone = ba.phone
FROM "BillingAddress" ba
WHERE a."orderId" = ba."orderId";

-- Set default values for any remaining null values
UPDATE "Address"
SET 
  name = 'Customer',
  email = 'customer@example.com'
WHERE name IS NULL OR email IS NULL;

-- Make the columns required
ALTER TABLE "Address" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "Address" ALTER COLUMN "email" SET NOT NULL;
