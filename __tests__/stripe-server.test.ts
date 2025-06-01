import { isStripeTestMode, getStripeEnvStatus } from '../lib/stripe-server';
describe('Stripe helpers', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });
  it('detects test mode', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
    expect(isStripeTestMode()).toBe(true);
    process.env.STRIPE_SECRET_KEY = 'sk_live_67890';
    expect(isStripeTestMode()).toBe(false);
  });
  it('returns correct env status', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abcde';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_98765';
    const status = getStripeEnvStatus();
    expect(status.isTestMode).toBe(true);
    expect(status.isConfigured).toBe(true);
    expect(status.secretKeyPresent).toBe(true);
    expect(status.publishableKeyPresent).toBe(true);
    expect(status.webhookSecretPresent).toBe(true);
    expect(status.secretKey.startsWith('sk_test_')).toBe(true);
    expect(status.publishableKey.startsWith('pk_test_')).toBe(true);
    expect(status.webhookSecret.startsWith('whsec_')).toBe(true);
  });
  it('handles missing keys', () => {
    process.env.STRIPE_SECRET_KEY = '';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = '';
    process.env.STRIPE_WEBHOOK_SECRET = '';
    const status = getStripeEnvStatus();
    expect(status.isConfigured).toBe(false);
    expect(status.secretKey).toBe('missing');
    expect(status.publishableKey).toBe('missing');
    expect(status.webhookSecret).toBe('missing');
  });
}); 