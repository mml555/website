-- 1. Create a mapping of old productId to new (lowest price) productId
WITH lowest_products AS (
  SELECT name, MIN(price) AS min_price
  FROM "Product"
  GROUP BY name
),
product_map AS (
  SELECT p.id AS old_id, lp_min.id AS new_id
  FROM "Product" p
  JOIN lowest_products lp ON p.name = lp.name
  JOIN "Product" lp_min ON lp_min.name = lp.name AND lp_min.price = lp.min_price
  WHERE p.id <> lp_min.id
)
UPDATE "OrderItem" oi
SET "productId" = pm.new_id
FROM product_map pm
WHERE oi."productId" = pm.old_id;

-- 2. Delete all products that are not the lowest price for their name
DELETE FROM "Product"
WHERE id NOT IN (
  SELECT MIN(id) FROM "Product" GROUP BY name
); 