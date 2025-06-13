export function generateOrderNumber(): string {
  // Generate a random 10-digit number
  const random = Math.floor(1000000000 + Math.random() * 9000000000);
  return random.toString();
}

export function formatOrderNumber(orderNumber: string | undefined | null): string {
  if (!orderNumber) return '';
  return orderNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
} 