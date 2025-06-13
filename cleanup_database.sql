-- Disable foreign key checks temporarily to allow for easier cleanup
SET session_replication_role = 'replica';

-- Delete data from all tables except Product and Category
TRUNCATE TABLE "ProductRelation" CASCADE;
TRUNCATE TABLE "ReviewHelpful" CASCADE;
TRUNCATE TABLE "Review" CASCADE;
TRUNCATE TABLE "ProductVariant" CASCADE;
TRUNCATE TABLE "Product" CASCADE;
TRUNCATE TABLE "Category" CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin'; 