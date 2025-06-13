# Cart System Type Issues

## Overview
This ticket tracks the remaining TypeScript type issues in the cart system that need to be addressed. These issues were identified during the cart system refactoring and hardening process.

## Current Issues

### 1. Inconsistent CartItem Type Definitions
**Status**: IDENTIFIED
**Description**: Multiple conflicting definitions of the CartItem type exist across the codebase:
- `types/cart.ts`: Basic cart item definition
- `types/product.ts`: Extended cart item definition with product and variant information
- `lib/cart.tsx`: Implementation using a mix of both definitions

This inconsistency leads to type inference issues and potential runtime errors.

### 2. Type Inference in React Components
**Status**: INVESTIGATING
**Description**: TypeScript is not properly inferring types in React components, particularly with:
- useCallback hooks
- State management
- Array operations (map, filter)
- Generic type parameters

## Root Cause Analysis

1. **Type Definition Inconsistency**
```typescript
// types/cart.ts
export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
  // ... other basic properties
}

// types/product.ts
export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  originalPrice: number;  // Different from cart.ts
  // ... additional properties
}
```

2. **State Management Issues**
- The `items` state is initialized with a basic type but used in contexts expecting extended types
- Type guards aren't properly narrowing the types
- Validation functions don't maintain type information

## Proposed Solutions

1. **Unified Type Definition**
```typescript
// types/cart.ts
export interface BaseCartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
}

export interface ProductCartItem extends BaseCartItem {
  variantId?: string;
  originalPrice: number;
  stock?: number;
  stockAtAdd?: number;
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
  } | null;
}

export type CartItem = BaseCartItem | ProductCartItem;
```

2. **Type Guard Implementation**
```typescript
export const isProductCartItem = (item: CartItem): item is ProductCartItem => {
  return 'originalPrice' in item && 'product' in item;
};

export const isBaseCartItem = (item: CartItem): item is BaseCartItem => {
  return !isProductCartItem(item);
};
```

3. **State Management Updates**
```typescript
const [items, setItems] = useState<CartItem[]>([]);

const setItemsWithPreservation = useCallback((newItems: CartItem[]) => {
  setItems(prevItems => {
    const itemMap = new Map(prevItems.map(item => [item.id, item]));
    newItems.forEach(item => {
      if (isProductCartItem(item) || isBaseCartItem(item)) {
        itemMap.set(item.id, item);
      }
    });
    return Array.from(itemMap.values());
  });
}, []);
```

## Implementation Steps

1. [ ] Create unified type definitions
2. [ ] Update all cart-related components to use new types
3. [ ] Implement type guards
4. [ ] Update state management
5. [ ] Add type validation in critical paths
6. [ ] Update tests to verify type safety

## Priority
High - This issue affects type safety and could lead to runtime errors if not addressed.

## Dependencies
- TypeScript configuration
- Cart system refactoring completion
- React's useCallback implementation

## Acceptance Criteria
- [ ] Single source of truth for CartItem type
- [ ] All type-related linter errors resolved
- [ ] Type safety maintained throughout cart operations
- [ ] No runtime type-related errors
- [ ] Existing functionality remains unchanged
- [ ] Unit tests pass
- [ ] Code review approval

## Notes
- Consider gradual rollout of type changes
- Document type usage patterns
- Add type validation in critical paths
- Consider impact on build performance 