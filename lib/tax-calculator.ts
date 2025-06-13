const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
] as const;

type USState = typeof US_STATES[number];

export type TaxCalculation = {
  subtotal: number;
  tax: number;
  total: number;
  rate: number;
};

const STATE_TAX_RATES: Record<string, number> = {
  'AL': 0.04, 'AK': 0, 'AZ': 0.056, 'AR': 0.065, 'CA': 0.0725,
  'CO': 0.029, 'CT': 0.0635, 'DE': 0, 'FL': 0.06, 'GA': 0.04,
  'HI': 0.04, 'ID': 0.06, 'IL': 0.0625, 'IN': 0.07, 'IA': 0.06,
  'KS': 0.065, 'KY': 0.06, 'LA': 0.0445, 'ME': 0.055, 'MD': 0.06,
  'MA': 0.0625, 'MI': 0.06, 'MN': 0.06875, 'MS': 0.07, 'MO': 0.04225,
  'MT': 0, 'NE': 0.055, 'NV': 0.0685, 'NH': 0, 'NJ': 0.06625,
  'NM': 0.05125, 'NY': 0.04, 'NC': 0.0475, 'ND': 0.05, 'OH': 0.0575,
  'OK': 0.045, 'OR': 0, 'PA': 0.06, 'RI': 0.07, 'SC': 0.06,
  'SD': 0.045, 'TN': 0.07, 'TX': 0.0625, 'UT': 0.061, 'VT': 0.06,
  'VA': 0.053, 'WA': 0.065, 'WV': 0.06, 'WI': 0.05, 'WY': 0.04,
  'DC': 0.06
};

/**
 * Validates state code and returns any validation errors
 */
export function validateState(state: string): string | null {
  if (!state) {
    return 'State is required';
  }
  const normalizedState = state.toUpperCase();
  if (!US_STATES.includes(normalizedState)) {
    return 'Invalid state code';
  }
  return null;
}

/**
 * Validates amount and returns any validation errors
 */
export function validateAmount(amount: number): string | null {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'Amount must be a number';
  }
  if (amount < 0) {
    return 'Amount must be positive';
  }
  return null;
}

/**
 * Calculates tax for a given amount and state
 */
export function calculateTax(amount: number, state: string): TaxCalculation {
  // Validate inputs
  const stateError = validateState(state);
  if (stateError) {
    throw new Error(stateError);
  }

  const amountError = validateAmount(amount);
  if (amountError) {
    throw new Error(amountError);
  }

  // Normalize state code
  const normalizedState = state.toUpperCase();
  
  // Get tax rate for state
  const rate = getTaxRateForState(normalizedState);
  
  // Calculate tax amount
  const tax = amount * rate;
  
  return {
    subtotal: amount,
    tax,
    total: amount + tax,
    rate
  };
}

function getTaxRateForState(state: string): number {
  // Check if state is valid
  const normalizedState = state.toUpperCase() as USState;
  if (!US_STATES.includes(normalizedState)) {
    return 0;
  }

  // Get tax rate for state
  const taxRate = STATE_TAX_RATES[normalizedState];
  if (taxRate === undefined) {
    throw new Error(`No tax rate found for state: ${state}`);
  }

  return taxRate;
}

/**
 * Checks if a US address is valid
 */
export function isValidUSAddress(address: { state: string; postalCode: string }): boolean {
  const stateError = validateState(address.state);
  if (stateError) {
    return false;
  }

  // Validate US ZIP code format
  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (!zipRegex.test(address.postalCode)) {
    return false;
  }

  return true;
} 