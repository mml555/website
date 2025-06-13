-- Create test user
INSERT INTO "User" (id, name, email, role, "createdAt", "updatedAt", "isGuest")
VALUES (
  'test_user_001',
  'Test User',
  'test@example.com',
  'USER',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  false
);

-- Create test product
INSERT INTO "Product" (id, name, description, price, stock, images, "isActive", "createdAt", "updatedAt")
VALUES (
  'test_product_001',
  'Test Product',
  'A test product for order confirmation',
  99.99,
  10,
  ARRAY['https://example.com/test.jpg'],
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Create test order
INSERT INTO "Order" (
  id,
  "userId",
  status,
  total,
  "orderNumber",
  "customerEmail",
  "paymentIntentId",
  "createdAt",
  "updatedAt"
)
VALUES (
  'test_order_001',
  'test_user_001',
  'PENDING',
  99.99,
  'TEST-001',
  'test@example.com',
  'pi_test123',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Create shipping address
INSERT INTO "Address" (
  id,
  "orderId",
  city,
  state,
  country,
  "createdAt",
  "updatedAt",
  "postalCode",
  street,
  name,
  email,
  phone
)
VALUES (
  'test_shipping_001',
  'test_order_001',
  'Test City',
  'Test State',
  'US',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  '12345',
  '123 Test Street',
  'Test User',
  'test@example.com',
  '+1234567890'
);

-- Create billing address
INSERT INTO "BillingAddress" (
  id,
  name,
  email,
  city,
  state,
  country,
  phone,
  "orderId",
  "createdAt",
  "updatedAt",
  "postalCode",
  street
)
VALUES (
  'test_billing_001',
  'Test User',
  'test@example.com',
  'Test City',
  'Test State',
  'US',
  '+1234567890',
  'test_order_001',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  '12345',
  '123 Test Street'
);

-- Create order item
INSERT INTO "OrderItem" (
  id,
  "orderId",
  "productId",
  quantity,
  price
)
VALUES (
  'test_order_item_001',
  'test_order_001',
  'test_product_001',
  1,
  99.99
); 