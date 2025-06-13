-- Delete existing test data
DELETE FROM "OrderItem" WHERE "orderId" = 'test_order_001';
DELETE FROM "Address" WHERE "orderId" = 'test_order_001';
DELETE FROM "BillingAddress" WHERE "orderId" = 'test_order_001';
DELETE FROM "Order" WHERE id = 'test_order_001';
DELETE FROM "Product" WHERE id = 'test_product_001';
DELETE FROM "User" WHERE id = 'test_user_001'; 