export function generateOrderNumber(): string {
  // Generate a random 11-digit number
  const random = Math.floor(10000000000 + Math.random() * 90000000000);
  return random.toString();
}

export function formatOrderNumber(orderNumber: string | undefined | null): string {
  if (!orderNumber) return '';
  return orderNumber.replace(/(\d{3})(\d{3})(\d{5})/, '$1-$2-$3');
} 