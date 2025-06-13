# Cart System Documentation

## Overview

The cart system is a robust, type-safe implementation that handles shopping cart functionality with performance optimizations and error handling. It provides a seamless shopping experience while ensuring data integrity and reliability.

## Architecture

### Core Components

1. **Cart Provider (`lib/cart-provider.tsx`)**
   - React context provider for cart state management
   - Handles cart operations (add, remove, update)
   - Implements performance optimizations
   - Manages error recovery
   - Syncs with server when user is logged in

2. **Cart Utilities (`lib/cart-utils.ts`)**
   - Type validation and guards
   - State persistence and loading
   - Cart state synchronization
   - Stock validation

3. **Cart Error Handling (`lib/cart-error.ts`)**
   - Custom error types and codes
   - Error recovery strategies
   - Backup and restore functionality
   - Graceful error handling

4. **Cart Performance (`lib/cart-performance.ts`)**
   - Memoized calculations
   - Debounced operations
   - Batch processing
   - State optimization
   - Cache management

### Type Definitions (`types/cart.ts`)

```typescript
interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
  stock: number;
  stockAtAdd: number;
  type: 'add';
  variantId?: string;
  originalPrice?: number;
  product?: {
    id: string;
    name: string;
    price: number;
    images: string[];
    stock: number;
  };
  variant?: {
    id: string;
    name: string;
    type: string;
  };
}

interface CartState {
  items: CartItem[];
  lastSynced: string;
  version: string;
  pendingChanges?: CartItem[];
}
```

## Features

### Type Safety
- Strong type definitions for all cart-related data
- Type guards for runtime validation
- Type-safe error handling
- Type checking in critical paths

### Error Handling
- Custom `CartError` class with error codes
- Recovery strategies for different error types
- Automatic backup and restore functionality
- Graceful degradation when errors occur

### Performance Optimizations
- Memoized calculations with TTL
- Debounced operations to prevent excessive updates
- Batch processing for multiple operations
- Optimized state updates
- Cache management for calculations

### State Management
- Local storage persistence
- Server synchronization
- Pending changes tracking
- Optimistic updates
- Conflict resolution

### Testing
- Unit tests for all components
- Integration tests for cart operations
- Error handling tests
- Performance optimization tests

## Usage

### Basic Usage

```typescript
import { useCart } from '@/lib/cart-provider';

function ProductCard({ product }) {
  const { addItem } = useCart();

  const handleAddToCart = async () => {
    try {
      await addItem({
        id: product.id,
        productId: product.id,
        quantity: 1,
        price: product.price,
        name: product.name,
        image: product.image,
        stock: product.stock,
        stockAtAdd: product.stock,
        type: 'add'
      });
    } catch (error) {
      // Error handling is built into the cart system
      console.error('Failed to add item:', error);
    }
  };

  return (
    <button onClick={handleAddToCart}>
      Add to Cart
    </button>
  );
}
```

### Error Handling

```typescript
import { CartError, CartErrorCodes } from '@/lib/cart-error';

try {
  await addItem(item);
} catch (error) {
  if (error instanceof CartError) {
    switch (error.code) {
      case CartErrorCodes.INVALID_ITEM:
        // Handle invalid item
        break;
      case CartErrorCodes.SYNC_FAILED:
        // Handle sync failure
        break;
      default:
        // Handle other errors
    }
  }
}
```

### Performance Optimization

```typescript
import { memoizeCartCalculation } from '@/lib/cart-performance';

const calculateTotal = memoizeCartCalculation(
  'cart-total',
  () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  5000 // 5 second TTL
);
```

## Best Practices

1. **Error Handling**
   - Always use try-catch blocks when calling cart operations
   - Handle specific error codes appropriately
   - Implement fallback behavior for critical operations

2. **Performance**
   - Use memoized calculations for expensive operations
   - Implement debouncing for frequent updates
   - Batch multiple operations when possible
   - Clear cache when appropriate

3. **Type Safety**
   - Use type guards for runtime validation
   - Validate input data before operations
   - Handle type errors gracefully

4. **State Management**
   - Keep cart state consistent
   - Handle pending changes appropriately
   - Implement proper sync strategies
   - Use optimistic updates when possible

## Testing

The cart system includes comprehensive tests:

- `__tests__/cart-provider.test.tsx`: Tests for the cart provider
- `__tests__/cart-utils.test.ts`: Tests for cart utilities
- `__tests__/cart-error.test.ts`: Tests for error handling
- `__tests__/cart-performance.test.ts`: Tests for performance optimizations

Run tests with:
```bash
npm test
```

## Future Improvements

1. **Performance**
   - Implement more advanced caching strategies
   - Add performance monitoring
   - Optimize sync operations

2. **Error Handling**
   - Add more recovery strategies
   - Improve error reporting
   - Enhance backup functionality

3. **Type Safety**
   - Add more type guards
   - Improve type inference
   - Enhance validation

4. **Testing**
   - Add more integration tests
   - Implement performance benchmarks
   - Add stress tests

## Contributing

1. Follow the type safety guidelines
2. Add tests for new functionality
3. Update documentation
4. Follow error handling patterns
5. Implement performance optimizations 