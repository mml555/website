/*
  Warnings:

  - A unique constraint covering the columns `[orderNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orderNumber` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- 1. Add the column as nullable
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;

-- 2. Populate orderNumber for existing rows (use a simple fallback, e.g., '20240527-XXXX')
UPDATE "Order"
SET "orderNumber" = '20240527-' || substr(md5(id), 1, 4)
WHERE "orderNumber" IS NULL;

-- 3. Set NOT NULL and add unique constraint
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
