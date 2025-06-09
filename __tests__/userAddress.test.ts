/**
 * @jest-environment node
 */
import {
  createUserAddress,
  listUserAddresses,
  updateUserAddress,
  deleteUserAddress
} from '@/lib/api/userAddress';
import { prisma } from '@/lib/prisma';

describe('User Address Utility', () => {
  let user: any;
  let addressId: string;

  beforeAll(async () => {
    // Create a test user
    user = await prisma.user.create({
      data: {
        email: 'test-address@example.com',
        name: 'Test Address User',
        password: 'password',
      },
    });
  });

  afterAll(async () => {
    // Clean up test user and addresses
    await prisma.userAddress.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should create a new address', async () => {
    const data = {
      type: 'SHIPPING',
      name: 'Test User',
      email: 'test-address@example.com',
      phone: '123-456-7890',
      street: '123 Main St',
      city: 'Testville',
      state: 'TS',
      postalCode: '12345',
      country: 'Testland',
    };
    const address = await createUserAddress(user.id, data);
    expect(address.name).toBe('Test User');
    addressId = address.id;
  });

  it('should list addresses', async () => {
    const addresses = await listUserAddresses(user.id);
    expect(Array.isArray(addresses)).toBe(true);
    expect(addresses.length).toBeGreaterThan(0);
  });

  it('should update an address', async () => {
    const data = {
      id: addressId,
      type: 'SHIPPING',
      name: 'Updated User',
      email: 'test-address@example.com',
      phone: '123-456-7890',
      street: '456 Main St',
      city: 'Testville',
      state: 'TS',
      postalCode: '12345',
      country: 'Testland',
    };
    const address = await updateUserAddress(user.id, data);
    expect(address.name).toBe('Updated User');
    expect(address.street).toBe('456 Main St');
  });

  it('should delete an address', async () => {
    const result = await deleteUserAddress(user.id, addressId);
    expect(result.id).toBe(addressId);
  });
}); 