// State tax rates (as of 2024)
const STATE_TAX_RATES: Record<string, number> = {
  'AL': 0.04, // Alabama
  'AK': 0.00, // Alaska (no state sales tax)
  'AZ': 0.056, // Arizona
  'AR': 0.065, // Arkansas
  'CA': 0.0725, // California
  'CO': 0.029, // Colorado
  'CT': 0.0635, // Connecticut
  'DE': 0.00, // Delaware (no state sales tax)
  'FL': 0.06, // Florida
  'GA': 0.04, // Georgia
  'HI': 0.04, // Hawaii
  'ID': 0.06, // Idaho
  'IL': 0.0625, // Illinois
  'IN': 0.07, // Indiana
  'IA': 0.06, // Iowa
  'KS': 0.065, // Kansas
  'KY': 0.06, // Kentucky
  'LA': 0.0445, // Louisiana
  'ME': 0.055, // Maine
  'MD': 0.06, // Maryland
  'MA': 0.0625, // Massachusetts
  'MI': 0.06, // Michigan
  'MN': 0.06875, // Minnesota
  'MS': 0.07, // Mississippi
  'MO': 0.04225, // Missouri
  'MT': 0.00, // Montana (no state sales tax)
  'NE': 0.055, // Nebraska
  'NV': 0.0685, // Nevada
  'NH': 0.00, // New Hampshire (no state sales tax)
  'NJ': 0.06625, // New Jersey
  'NM': 0.05125, // New Mexico
  'NY': 0.04, // New York
  'NC': 0.0475, // North Carolina
  'ND': 0.05, // North Dakota
  'OH': 0.0575, // Ohio
  'OK': 0.045, // Oklahoma
  'OR': 0.00, // Oregon (no state sales tax)
  'PA': 0.06, // Pennsylvania
  'RI': 0.07, // Rhode Island
  'SC': 0.06, // South Carolina
  'SD': 0.045, // South Dakota
  'TN': 0.07, // Tennessee
  'TX': 0.0625, // Texas
  'UT': 0.061, // Utah
  'VT': 0.06, // Vermont
  'VA': 0.053, // Virginia
  'WA': 0.065, // Washington
  'WV': 0.06, // West Virginia
  'WI': 0.05, // Wisconsin
  'WY': 0.04, // Wyoming
  'DC': 0.06, // District of Columbia
}

// County tax rates (example for a few major counties)
const COUNTY_TAX_RATES: Record<string, Record<string, number>> = {
  'CA': {
    'Los Angeles': 0.01, // 1% county tax
    'San Diego': 0.008, // 0.8% county tax
    'Orange': 0.0075, // 0.75% county tax
  },
  'NY': {
    'New York': 0.00475, // 0.475% county tax
    'Kings': 0.00475, // 0.475% county tax
    'Queens': 0.00475, // 0.475% county tax
  },
  'TX': {
    'Harris': 0.01, // 1% county tax
    'Dallas': 0.01, // 1% county tax
    'Tarrant': 0.01, // 1% county tax
  },
  // Add more counties as needed
}

export interface TaxCalculation {
  subtotal: number;
  stateTaxRate: number;
  countyTaxRate: number;
  stateTaxAmount: number;
  countyTaxAmount: number;
  totalTaxAmount: number;
  total: number;
}

export const US_STATES = Object.keys(STATE_TAX_RATES)

export function isValidUSState(state: string): boolean {
  return US_STATES.includes(state)
}

export function isValidUSAddress(address: {
  country: string;
  state: string;
  postalCode: string;
}): boolean {
  return (
    address.country === 'USA' &&
    isValidUSState(address.state) &&
    /^\d{5}(-\d{4})?$/.test(address.postalCode)
  )
}

export function calculateTax(
  subtotal: number,
  state: string,
  county?: string
): TaxCalculation {
  const stateTaxRate = STATE_TAX_RATES[state] || 0
  const countyTaxRate = county ? (COUNTY_TAX_RATES[state]?.[county] || 0) : 0

  const stateTaxAmount = subtotal * stateTaxRate
  const countyTaxAmount = subtotal * countyTaxRate
  const totalTaxAmount = stateTaxAmount + countyTaxAmount
  const total = subtotal + totalTaxAmount

  return {
    subtotal,
    stateTaxRate,
    countyTaxRate,
    stateTaxAmount,
    countyTaxAmount,
    totalTaxAmount,
    total
  }
}

// Helper function to get available counties for a state
export function getCountiesForState(state: string): string[] {
  return Object.keys(COUNTY_TAX_RATES[state] || {})
} 