"use client";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { getGuestCart, syncCartWithServer } from '@/lib/redis';
import { debounce } from 'lodash';
import { handleApiError, validatePrice } from '@/lib/AppUtils';
import type { CartItem, CartItemInput, CartContextType, CartState, BaseCartItem, ProductCartItem } from '@/types/cart';
import { isBaseCartItem, isProductCartItem } from '@/types/cart';
import {
  loadCartState,
  validateCartItem,
  cartQueue
} from '../lib/cart-utils';
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { AppError } from './app-errors';
import { v4 as uuidv4 } from 'uuid';
import { generateCartItemId } from './cart-utils';
import { logger } from '@/lib/logger';
import { useToast } from '@/components/ui/use-toast';
import { CartError, CartErrorCodes, handleCartError, createCartBackup, restoreFromBackup } from './cart-error';

interface CartChange {
  id: string;
  productId: string;
  quantity: number;
  originalQuantity?: number;
  price: number;
  originalPrice?: number;
  name: string;
  image?: string;
  stock?: number;
  stockAtAdd?: number;
  variantId?: string;
  type?: 'add' | 'remove' | 'update' | 'clear';
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

export interface CartContextType {
    items: CartItem[];
    addItem: (item: CartItemInput, quantity?: number) => Promise<void>;
    removeItem: (id: string, variantId?: string) => Promise<void>;
    updateQuantity: (id: string, quantity: number, variantId?: string) => Promise<void>;
    clearCart: () => void;
    total: number;
    itemCount: number;
    error: string | null;
    clearError: () => void;
    isLoading: boolean;
    retrySync: () => Promise<void>;
    pendingChanges: CartItem[];
    cartExpiryWarning: string | null;
    // Cart sharing methods
    generateShareableCartLink: () => Promise<string | null>;
    loadSharedCart: (shareId: string) => Promise<boolean>;
    // Save for later
    savedForLater: CartItem[];
    moveToSaveForLater: (id: string, variantId?: string) => void;
    moveToCartFromSaveForLater: (id: string, variantId?: string) => void;
}

export interface CartItemInput {
    productId: string;
    variantId?: string;
    name: string;
    price: number;
    image?: string;
    quantity: number;
    stock?: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface StockInfo {
    id: string;
    stock: number;
    price: number;
    name?: string;
}

// Helper to check if localStorage is available
function isLocalStorageAvailable() {
    if (typeof window === 'undefined') return false;
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

const INITIAL_DEBOUNCE = 15000; // 15 seconds
const MAX_DEBOUNCE = 120000; // 2 minutes
const COOLDOWN_PERIOD = 300000; // 5 minutes

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

// Debounce configuration
const DEBOUNCE_DELAY = 3000; // 3 seconds
const RATE_LIMIT_COOLDOWN_MS = 30000; // 30 seconds

interface CartProviderProps {
    children: ReactNode;
}

// Helper: Merge two cart arrays, prefer higher quantity and earliest stockAtAdd
function mergeCarts(localItems: CartItem[], serverItems: CartItem[]): CartItem[] {
    const normalize = (item: any): CartItem => ({ ...item, productId: item.productId || item.id });
    const merged = new Map<string, CartItem>();
    serverItems.map(normalize).forEach(item => merged.set(item.id, item));
    localItems.map(normalize).forEach(item => {
        if (merged.has(item.id)) {
            const serverItem = merged.get(item.id)!;
            merged.set(item.id, {
                ...serverItem,
                quantity: Math.max(serverItem.quantity, item.quantity)
            });
        } else {
            merged.set(item.id, item);
        }
    });
    return Array.from(merged.values());
}

// Add type guard for CartItem
const isCartItem = (item: unknown): item is CartItem => {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'productId' in item &&
    'quantity' in item &&
    'price' in item &&
    'name' in item
  );
};

export function CartProvider({ children }: CartProviderProps) {
    const isClient = typeof window !== 'undefined';
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();
    const [items, setItems] = useState<CartItem[]>([]);
    const [total, setTotal] = useState(0);
    const [itemCount, setItemCount] = useState(0);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<CartItem[]>([]);
    const [cartLoaded, setCartLoaded] = useState(false);
    const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);
    const [rateLimitCooldown, setRateLimitCooldown] = useState(false);
    const [guestId, setGuestId] = useState<string | null>(null);
    const cooldownTimeoutRef = useRef<NodeJS.Timeout>();
    const userInitiatedRef = useRef(false);
    const hasMergedRef = useRef(false);
    const prevStatusRef = useRef(status);
    const previouslyAuthenticatedRef = useRef(false);
    const localStorageAvailable = isClient && isLocalStorageAvailable();
    const isSyncing = useRef(false);
    const [debounceInterval, setDebounceInterval] = useState(INITIAL_DEBOUNCE);
    const itemsRef = useRef(items);
    const retryCount = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const lastSyncTimeRef = useRef<number>(0);
    const [cartExpiryWarning, setCartExpiryWarning] = useState<string | null>(null);

    // --- Mutation queue for atomic cart updates ---
    const mutationQueue = useRef<(() => Promise<void>)[]>([]);
    const isMutating = useRef(false);
    const runNextMutation = useCallback(() => {
        if (isMutating.current || mutationQueue.current.length === 0) return;
        isMutating.current = true;
        const next = mutationQueue.current.shift();
        if (next) {
            next().finally(() => {
                isMutating.current = false;
                runNextMutation();
            });
        }
    }, []);
    const enqueueMutation = useCallback((fn: () => Promise<void>) => {
        mutationQueue.current.push(fn);
        runNextMutation();
    }, [runNextMutation]);

    // Initialize guestId immediately for unauthenticated users
    useEffect(() => {
        if (!isClient) return;
        if (status === 'authenticated') {
            setGuestId(null);
            return;
        }
        let storedGuestId = null;
        try {
            storedGuestId = localStorage.getItem('guestId');
        } catch {}
        if (!storedGuestId) {
            storedGuestId = uuidv4();
            try {
                localStorage.setItem('guestId', storedGuestId);
            } catch {}
        }
        setGuestId(storedGuestId);
    }, [isClient, status]);

    // Keep itemsRef in sync with items state
    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    // Memoized setItems function that preserves existing items
    const setItemsWithPreservation = useCallback((newItems: CartItem[]) => {
        setItems(prevItems => {
            const itemMap = new Map(prevItems.map((item: CartItem) => [item.id, item]));
            newItems.forEach((item: CartItem) => {
                if (isBaseCartItem(item) || isProductCartItem(item)) {
                    itemMap.set(item.id, item);
                } else {
                    logger.warn(item, 'Invalid cart item found during preservation');
                }
            });
            return Array.from(itemMap.values());
        });
    }, []);

    // Cleanup function for timeouts
    const cleanupTimeouts = useCallback(() => {
        if (cooldownTimeoutRef.current) {
            clearTimeout(cooldownTimeoutRef.current);
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    // Debounced sync function with exponential backoff
    const debouncedSyncCart = useMemo(() => 
        debounce(async (itemsToSync: CartItem[]) => {
            if (!isClient || status === 'loading') return;
            
            try {
                logger.debug(itemsToSync, 'Syncing cart with server');
                const response = await fetch('/api/cart/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        items: itemsToSync,
                        guestId: status === 'unauthenticated' ? guestId : undefined
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to sync cart');
                }

                const data = await response.json();
                logger.debug(data, 'Cart sync response');

                if (data.items && JSON.stringify(data.items) !== JSON.stringify(itemsToSync)) {
                    logger.debug('Updating items from sync response');
                    setItemsWithPreservation(data.items);
                }

                // Reset retry state on success
                retryCount.current = 0;
                setDebounceInterval(INITIAL_DEBOUNCE);
                setPendingChanges([]);
            } catch (error) {
                logger.error(error, 'Error syncing cart');
                setError(error instanceof Error ? error : new Error('Failed to sync cart with server'));
                
                // Implement exponential backoff
                if (retryCount.current < MAX_RETRIES) {
                    const nextDelay = Math.min(debounceInterval, MAX_RETRY_DELAY);
                    setDebounceInterval(nextDelay);
                    retryCount.current++;
                    
                    timeoutRef.current = setTimeout(() => {
                        debouncedSyncCart(itemsToSync);
                    }, nextDelay);
                }
            }
        }, 1000)
    , [isClient, status, setItemsWithPreservation, retryCount, debounceInterval]);

    // Update the syncCart function to handle IDs consistently
    const syncCart = useCallback(async (items: CartItem[]) => {
        try {
            logger.debug('Syncing cart with server');
            const response = await fetch('/api/cart/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: items.map((item: CartItem) => ({
                        id: item.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        price: item.price,
                        name: item.name,
                        image: item.image,
                        stock: item.stock
                    }))
                })
            });

            if (!response.ok) {
                throw new Error('Failed to sync cart');
            }

            const data = await response.json();
            logger.debug(data, 'Cart sync response');

            if (data.items) {
                const validItems = data.items
                    .map(validateCartItem)
                    .filter((item): item is CartItem => item !== null);
                logger.debug(validItems, 'Valid items from sync');
                setItemsWithPreservation(validItems);
            }
        } catch (error) {
            logger.error(error, 'Error syncing cart');
            setError(error instanceof Error ? error : new Error('Failed to sync cart'));
            throw error;
        }
    }, [setItemsWithPreservation]);

    // Persist cart state to localStorage
    const persistCartState = useCallback((itemsToPersist: CartItem[], pendingChangesToPersist: CartChange[]) => {
        if (!isClient || !localStorageAvailable) return;
        
        try {
            const cartState = {
                items: itemsToPersist,
                pendingChanges: pendingChangesToPersist,
                lastSynced: Date.now()
            };
            localStorage.setItem('cart', JSON.stringify(cartState));
        } catch (error) {
            console.error('Error persisting cart state:', error);
        }
    }, [isClient, localStorageAvailable]);

    // Load cart on mount
    useEffect(() => {
        const loadCart = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Try to load from localStorage first
                const savedState = loadCartState();
                if (savedState) {
                    setItems(savedState.items);
                    setLastSynced(savedState.lastSynced);
                    if (savedState.pendingChanges) {
                        setPendingChanges(savedState.pendingChanges);
                    }
                }

                // If user is logged in, sync with server
                if (session?.user) {
                    await syncCart(items);
                }
            } catch (error) {
                const { recovered, result } = await handleCartError(error, {
                    operation: 'loadCart',
                    items: items
                });

                if (recovered && result) {
                    if (Array.isArray(result)) {
                        setItems(result);
                    } else {
                        setItems(result.items);
                        setLastSynced(result.lastSynced);
                        if (result.pendingChanges) {
                            setPendingChanges(result.pendingChanges);
                        }
                    }
                } else {
                    setError(error instanceof Error ? error : new Error('Failed to load cart'));
                    toast({
                        title: 'Error',
                        description: 'Failed to load your cart. Please try again.',
                        variant: 'destructive'
                    });
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadCart();
    }, [session?.user]);

    // Calculate cart totals
    useEffect(() => {
        const safeItems = items ?? [];
        logger.debug(safeItems, 'Calculating cart totals');
        
        const newTotal = safeItems.reduce((sum, item: CartItem) => {
            try {
                const itemPrice = item.price;
                const itemQuantity = item.quantity;
                
                if (!itemPrice || !itemQuantity || isNaN(itemPrice) || isNaN(itemQuantity) || itemQuantity <= 0 || itemPrice <= 0) {
                    logger.warn(item, 'Invalid cart item (invalid price or quantity)');
                    return sum;
                }
                
                const itemTotal = itemPrice * itemQuantity;
                logger.debug(itemTotal, 'Item total');
                return sum + (isNaN(itemTotal) ? 0 : itemTotal);
            } catch (err) {
                logger.error(err, 'Error processing cart item');
                return sum;
            }
        }, 0);

        logger.debug(newTotal, 'Final cart total');
        
        // Ensure total is a valid positive number
        const validTotal = isNaN(newTotal) || newTotal < 0 ? 0 : newTotal;
        setTotal(validTotal);
    }, [items]);

    // Sync cart with server every 10 minutes, and immediately on login/mount
    useEffect(() => {
        if (!isClient || !session?.user) return;
        const shouldSync = (items && items.length > 0) || (pendingChanges && pendingChanges.length > 0);
        const now = Date.now();
        if (shouldSync) {
            if (now - lastSyncTimeRef.current > 5000) {
                syncCart(items);
                lastSyncTimeRef.current = now;
            } else {
            }
        } else {
        }
        if (shouldSync) {
            const interval = setInterval(() => {
                const now = Date.now();
                if (now - lastSyncTimeRef.current > 5000) {
                    syncCart(items);
                    lastSyncTimeRef.current = now;
                }
            }, 10 * 60 * 1000);
            return () => clearInterval(interval);
        }
        return undefined;
    }, [isClient, session?.user, items, pendingChanges, syncCart]);

    // Update the findItem function to handle variant types
    const findItem = (items: CartItem[], productId: string, variantId?: string): CartItem | undefined => {
        return items.find(item => {
            if (variantId) {
                return item.productId === productId && 
                    'variantId' in item && 
                    item.variantId === variantId;
            }
            return item.productId === productId;
        });
    };

    // Update the addItem function to handle variant types
    const addItem = useCallback(async (input: CartItemInput) => {
        try {
            setError(null);
            const validatedItem = validateCartItem(input);
            
            if (!validatedItem) {
                throw new CartError(
                    'Invalid item data',
                    CartErrorCodes.INVALID_ITEM,
                    { input }
                );
            }

            setItems(prevItems => {
                const existingItem = findItem(prevItems, validatedItem.productId, 'variantId' in validatedItem ? validatedItem.variantId : undefined);

                if (existingItem) {
                    return prevItems.map(item =>
                        item.id === existingItem.id
                            ? { ...item, quantity: item.quantity + validatedItem.quantity }
                            : item
                    );
                }

                return [...prevItems, validatedItem];
            });

            setPendingChanges(prev => [...prev, validatedItem]);
            debouncedSyncCart(items);
        } catch (error) {
            const { recovered, result } = await handleCartError(error, {
                operation: 'addItem',
                items: items
            });

            if (!recovered) {
                setError(error instanceof Error ? error : new Error('Failed to add item'));
                toast({
                    title: 'Error',
                    description: 'Failed to add item to cart. Please try again.',
                    variant: 'destructive'
                });
            }
        }
    }, [items, debouncedSyncCart]);

    // Update the removeItem function with proper type handling
    const removeItem = useCallback(async (itemId: string, variantId?: string) => {
        try {
            logger.debug({ itemId, variantId }, 'Removing item from cart');
            
            const updatedItems = items.filter((item: CartItem): boolean => {
                if (!isBaseCartItem(item) && !isProductCartItem(item)) {
                    logger.warn(item, 'Invalid cart item found during removal');
                    return false;
                }
                if (variantId && isProductCartItem(item)) {
                    return !(item.id === itemId && item.variantId === variantId);
                }
                return item.id !== itemId;
            });
            setItemsWithPreservation(updatedItems);
            
            // Sync with server
            await syncCart(updatedItems);
        } catch (error) {
            logger.error(error, 'Error removing item from cart');
            setError(error instanceof Error ? error : new Error('Failed to remove item from cart'));
            toast({
                title: 'Error',
                description: 'Failed to remove item from cart. Please try again.',
                variant: 'destructive'
            });
        }
    }, [items, setItemsWithPreservation, syncCart]);

    // Update the updateQuantity function with proper type handling
    const updateQuantity = useCallback(async (itemId: string, quantity: number, variantId?: string) => {
        try {
            logger.debug({ itemId, quantity, variantId }, 'Updating item quantity');
            
            if (quantity <= 0) {
                await removeItem(itemId, variantId);
                return;
            }

            const updatedItems = items.map((item: CartItem): CartItem => {
                if (!isBaseCartItem(item) && !isProductCartItem(item)) {
                    logger.error(item, 'Invalid cart item found during quantity update');
                    throw new Error('Invalid cart item');
                }
                if (variantId && isProductCartItem(item)) {
                    return (item.id === itemId && item.variantId === variantId) ? { ...item, quantity } : item;
                }
                return item.id === itemId ? { ...item, quantity } : item;
            });
            setItemsWithPreservation(updatedItems);
            
            // Sync with server
            await syncCart(updatedItems);
        } catch (error) {
            logger.error(error, 'Error updating item quantity');
            setError(error instanceof Error ? error : new Error('Failed to update item quantity'));
            toast({
                title: 'Error',
                description: 'Failed to update item quantity. Please try again.',
                variant: 'destructive'
            });
        }
    }, [items, setItemsWithPreservation, removeItem, syncCart]);

    // --- Wrap cart mutations ---
    const atomicAddItem = useCallback(async (item: CartItemInput, quantity: number = 1) => {
        return new Promise<void>((resolve, reject) => {
            enqueueMutation(async () => {
                try {
                    await addItem(item);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }, [addItem, enqueueMutation]);
    const atomicUpdateQuantity = useCallback(async (id: string, quantity: number, variantId?: string) => {
        return new Promise<void>((resolve, reject) => {
            enqueueMutation(async () => {
                try {
                    await updateQuantity(id, quantity, variantId);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }, [updateQuantity, enqueueMutation]);
    const atomicRemoveItem = useCallback(async (id: string, variantId?: string) => {
        return new Promise<void>((resolve, reject) => {
            enqueueMutation(async () => {
                try {
                    await removeItem(id, variantId);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }, [removeItem, enqueueMutation]);

    // Helper to clear cart state and localStorage
    const clearCartAndStorage = useCallback(() => {
        setItems([]);
        setPendingChanges([]);
        if (isClient && typeof window !== 'undefined') {
            localStorage.removeItem('cartState');
        }
        cartQueue.clear();
    }, [isClient]);

    // Replace clearCart with clearCartAndStorage in logout/clear cart flows
    const clearCart = useCallback(async () => {
        userInitiatedRef.current = true;
        clearCartAndStorage();
        if (status === 'authenticated') {
            debouncedSyncCart([]);
        } else if (guestId) {
            // For guest users, also clear the guest cart from Redis
            fetch('/api/cart/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId }),
            }).catch(console.error);
        }
    }, [clearCartAndStorage, debouncedSyncCart, status, guestId]);

    // Auto-clear error after 5 seconds unless cleared manually
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const clearError = useCallback(() => setError(null), []);

    const retrySync = useCallback(async () => {
        if (pendingChanges.length > 0) {
            await syncCart(pendingChanges);
        }
    }, [pendingChanges, syncCart]);

    // Guest cart expiry warning
    useEffect(() => {
        if (!isClient || status !== 'unauthenticated') return;
        // Guest cart TTL is 5 minutes (300000 ms)
        const cartStateRaw = typeof window !== 'undefined' ? localStorage.getItem('cartState') : null;
        let lastSynced: number | null = null;
        if (cartStateRaw) {
            try {
                const cartState = JSON.parse(cartStateRaw);
                if (cartState && cartState.lastSynced) {
                    lastSynced = new Date(cartState.lastSynced).getTime();
                }
            } catch {}
        }
        if (lastSynced) {
            const now = Date.now();
            const msLeft = 300000 - (now - lastSynced);
            if (msLeft < 60000 && msLeft > 0) {
                setCartExpiryWarning(`Your cart will expire in ${Math.ceil(msLeft / 1000)} seconds. Please complete checkout or refresh your cart.`);
            } else {
                setCartExpiryWarning(null);
            }
        } else {
            setCartExpiryWarning(null);
        }
        const interval = setInterval(() => {
            if (!lastSynced) return;
            const now = Date.now();
            const msLeft = 300000 - (now - lastSynced);
            if (msLeft < 60000 && msLeft > 0) {
                setCartExpiryWarning(`Your cart will expire in ${Math.ceil(msLeft / 1000)} seconds. Please complete checkout or refresh your cart.`);
            } else {
                setCartExpiryWarning(null);
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [isClient, status]);

    // --- Cart Sharing ---
    const generateShareableCartLink = useCallback(async (): Promise<string | null> => {
        if (!items || items.length === 0) {
            setError(new Error('Cannot share an empty cart.'));
            return null;
        }
        try {
            // Placeholder: POST to /api/cart/share with cart items
            const res = await fetch('/api/cart/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
            if (!res.ok) throw new Error('Failed to generate shareable link');
            const data = await res.json();
            return data.shareId ? `${window.location.origin}/cart/shared/${data.shareId}` : null;
        } catch (err) {
            setError(new Error('Failed to generate shareable cart link.'));
            return null;
        }
    }, [items]);

    const loadSharedCart = useCallback(async (shareId: string): Promise<boolean> => {
        try {
            // Placeholder: GET from /api/cart/share/[shareId]
            const res = await fetch(`/api/cart/share/${shareId}`);
            if (!res.ok) throw new Error('Invalid or expired cart link');
            const data = await res.json();
            if (data && Array.isArray(data.items)) {
                setItems(data.items);
                persistCartState(data.items, []);
                return true;
            }
            return false;
        } catch (err) {
            setError(new Error('Failed to load shared cart.'));
            return false;
        }
    }, [persistCartState]);

    // Load savedForLater from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem('savedForLater');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setSavedForLater(parsed);
            }
        } catch {}
    }, []);

    // Persist savedForLater to localStorage
    useEffect(() => {
        if (!isClient) return;
        try {
            localStorage.setItem('savedForLater', JSON.stringify(savedForLater));
        } catch {}
    }, [savedForLater, isClient]);

    // Move item from cart to save for later
    const moveToSaveForLater = useCallback((id: string, variantId?: string) => {
        setItems(prev => {
            const idx = prev.findIndex(item => item.id === id && (!variantId || item.variantId === variantId));
            if (idx === -1) return prev;
            const item = prev[idx];
            setSavedForLater(sfl => [...sfl, item]);
            return prev.filter((_, i) => i !== idx);
        });
    }, []);

    // Move item from save for later to cart
    const moveToCartFromSaveForLater = useCallback((id: string, variantId?: string) => {
        setSavedForLater(prev => {
            const idx = prev.findIndex(item => item.id === id && (!variantId || item.variantId === variantId));
            if (idx === -1) return prev;
            const item = prev[idx];
            setItems(items => [...items, item]);
            return prev.filter((_, i) => i !== idx);
        });
    }, []);

    const value = useMemo(
        () => ({
            items,
            addItem: atomicAddItem,
            removeItem: atomicRemoveItem,
            updateQuantity: atomicUpdateQuantity,
            clearCart,
            total,
            itemCount,
            error,
            clearError,
            isLoading,
            retrySync,
            pendingChanges,
            cartExpiryWarning,
            generateShareableCartLink,
            loadSharedCart,
            savedForLater,
            moveToSaveForLater,
            moveToCartFromSaveForLater,
        }),
        [items, atomicAddItem, atomicRemoveItem, atomicUpdateQuantity, clearCart, total, itemCount, error, clearError, isLoading, retrySync, pendingChanges, cartExpiryWarning, generateShareableCartLink, loadSharedCart, savedForLater, moveToSaveForLater, moveToCartFromSaveForLater]
    );

    // On login, merge guest and server cart, sync merged cart (only on transition)
    useEffect(() => {
        if (
            isClient &&
            cartLoaded &&
            status === 'authenticated' &&
            prevStatusRef.current === 'unauthenticated' &&
            session?.user &&
            !hasMergedRef.current
        ) {
            (async () => {
                // Merge guest cart from Redis if guestId exists
                if (guestId) {
                    try {
                        const res = await fetch('/api/cart/merge', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ guestId }),
                        });
                        if (res.ok) {
                            // Clear guest cart from localStorage and remove guestId
                            localStorage.removeItem('cartState');
                            localStorage.removeItem('guestId');
                            setGuestId(null);
                            const data = await res.json();
                            if (data && Array.isArray(data.items)) {
                                userInitiatedRef.current = false;
                                setItems(data.items);
                                setPendingChanges([]);
                                persistCartState(data.items, []);
                            }
                        }
                    } catch (err) {
                    }
                } else {
                    // Fallback: merge local guest cart with server cart as before
                    const guestCartState = loadCartState();
                    const guestItems = Array.isArray(guestCartState?.items) ? guestCartState.items : [];
                    // Fetch server cart
                    let serverItems: any[] = [];
                    try {
                        const res = await fetch('/api/cart', { credentials: 'include' });
                        if (res.ok) {
                            const data: any = await res.json();
                            if (data && typeof data === 'object') {
                                if (Array.isArray(data.items)) {
                                    serverItems = data.items;
                                } else if (data.data && Array.isArray(data.data.items)) {
                                    serverItems = data.data.items;
                                }
                            }
                        }
                    } catch {}
                    // Ensure all items have productId (fallback to id)
                    const normalizedGuestItems = guestItems.map((item: any) => ({ ...item, productId: item.productId || item.id }));
                    const normalizedServerItems = serverItems.map((item: any) => ({ ...item, productId: item.productId || item.id }));
                    // Merge carts
                    const merged: CartItem[] = mergeCarts(normalizedGuestItems, normalizedServerItems as CartItem[]);
                    if (!Array.isArray(merged)) {
                        userInitiatedRef.current = false;
                        setItems([]);
                    } else {
                        userInitiatedRef.current = false;
                        setItems(merged);
                    }
                    persistCartState(Array.isArray(merged) ? merged : [], Array.isArray(pendingChanges) ? pendingChanges : []);
                    // Sync merged cart to server
                    if (session?.user) {
                        const validMerged = (Array.isArray(merged) ? merged : []).filter(validateCartItem);
                        if (validMerged.length !== (Array.isArray(merged) ? merged.length : 0)) {
                        }
                        const apiItems = validMerged.map(item => ({
                            id: item.productId,
                            quantity: item.quantity,
                            ...(typeof item.variantId === 'string' && item.variantId ? { variantId: item.variantId } : {}),
                            ...(typeof item.stockAtAdd === 'number' ? { stockAtAdd: item.stockAtAdd } : {}),
                        }));
                        fetch('/api/cart/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ items: apiItems }),
                        });
                    }
                }
                hasMergedRef.current = true;
            })();
        }
        prevStatusRef.current = status;
        if (status === 'authenticated') {
            previouslyAuthenticatedRef.current = true;
        }
        if (status === 'unauthenticated') {
            hasMergedRef.current = false;
        }
    }, [isClient, cartLoaded, status, session, pendingChanges, guestId, persistCartState]);

    // On logout, clear cart only if previously authenticated
    useEffect(() => {
        if (isClient && status === 'unauthenticated' && previouslyAuthenticatedRef.current) {
            clearCartAndStorage();
            previouslyAuthenticatedRef.current = false;
        }
    }, [isClient, status, clearCartAndStorage]);

    // Fallback: ensure isLoading never hangs forever
    useEffect(() => {
        if (isLoading) {
            const timeout = setTimeout(() => {
                setIsLoading(false);
            }, 3000);
            return () => clearTimeout(timeout);
        }
    }, [isLoading]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupTimeouts();
        };
    }, [cleanupTimeouts]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
