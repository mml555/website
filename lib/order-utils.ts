export function generateOrderNumber(): string {
  // Get current timestamp
  const timestamp = Date.now().toString();
  
  // Generate a random 4-digit number
  const random = Math.floor(1000 + Math.random() * 9000);
  
  // Format: YYYYMMDD-RANDOM
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}${month}${day}-${random}`;
}

export function formatOrderNumber(orderNumber: string): string {
  // Format: YYYY-MMDD-XXXX
  const year = orderNumber.substring(0, 4);
  const monthDay = orderNumber.substring(4, 8);
  const random = orderNumber.substring(9);
  
  return `${year}-${monthDay}-${random}`;
} 