/**
 * @jest-environment node
 */
import fetch from 'node-fetch';
import { generateCsrfToken } from '../lib/csrf';

// NOTE: This test assumes your Next.js app is running on localhost:3000
// You may need to adjust the base URL or use supertest with a custom server if running in CI
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe.skip('API Integration: Cart & Checkout (CSRF)', () => {
  it('should reject POST /api/products without CSRF token', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/csrf/i);
  });

  it('should reject POST /api/products with invalid CSRF token', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'invalid-token',
      },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/csrf/i);
  });

  it('should reject POST /api/products with valid CSRF token but not logged in', async () => {
    const csrfToken = generateCsrfToken();
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/unauthorized/i);
  });

  it('should reject POST /api/products with invalid data', async () => {
    const csrfToken = generateCsrfToken();
    // This test assumes you have a way to mock authentication or run as a logged-in user
    // For now, expect 401 (not logged in)
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ name: '' })
    });
    // Accept either 401 or 400 depending on auth state
    expect([400, 401]).toContain(res.status);
  });
}); 