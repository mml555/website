import { test, expect } from '@playwright/test';

test('guest checkout flow', async ({ page }) => {
  await page.goto('http://localhost:3000/products');
  await page.click('text=Add to Cart');
  await page.goto('http://localhost:3000/checkout');
  await page.fill('input[name="email"]', 'test@example.com');
  // Fill other required fields as needed
  await page.click('text=Place Order');
  await expect(page).toHaveText('Order Confirmation');
}); 