"use client";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { useSession } from "next-auth/react";
import debounce from 'lodash/debounce';
import { handleApiError } from '../lib/utils';
import type { CartItem } from '../types/product';
import {
  generateCartItemId,
  syncWithRetry,
  validateStockBeforeSync,
  persistCartState,
  loadCartState,
  resolveCartConflicts,
  validateCartItem,
  compressCartData,
  decompressCartData,
  cartQueue,
  type CartState
} from '../lib/cart-utils';
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { AppError } from './app-errors';
import { v4 as uuidv4 } from 'uuid';

export interface CartItemInput {
    productId: string;
    variantId?: string;
    name: string;
    price: number;
    image: string;
    stock?: number;
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
const RETRY_DELAY = 1000; // 1 second

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

export function CartProvider({ children }: CartProviderProps) {
    const { data: session, status } = useSession();
    const [items, setItems] = useState<CartItem[]>([]);
    const [total, setTotal] = useState(0);
    const [itemCount, setItemCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<CartItem[]>([]);
    const [isClient, setIsClient] = useState(false);
    const localStorageAvailable = isClient && typeof window !== 'undefined' && window.localStorage;
    const isSyncing = useRef(false);
    const [rateLimitCooldown, setRateLimitCooldown] = useState(false);
    const [debounceInterval, setDebounceInterval] = useState(INITIAL_DEBOUNCE);
    const itemsRef = useRef(items);
    const router = useRouter();
    const retryCount = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Track previous session status to detect login transition and logout
    const prevStatusRef = useRef<string | undefined>(undefined);
    const previouslyAuthenticatedRef = useRef(false);
    // Add a ref to ensure merge only happens once per login
    const hasMergedRef = useRef(false);
    const [cartLoaded, setCartLoaded] = useState(false);
    const [guestId, setGuestId] = useState<string | null>(null);
    // Add a ref to track if the cart update is user-initiated
    const userInitiatedRef = useRef(false);
    // Add a ref to track the last sync time
    const lastSyncTimeRef = useRef<number>(0);

    // Keep itemsRef in sync with items state
    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    // Set isClient to true when component mounts
    useEffect(() => {
        setIsClient(true);
        console.log('[Cart][DEBUG] isClient set to true');
    }, []);

    // Track session and status for debug
    useEffect(() => {
        if (typeof window !== 'undefined') {
            console.log('[Cart][DEBUG] Session:', session, 'Status:', status);
        }
    }, [session, status]);

    // Calculate total and item count whenever items change
    useEffect(() => {
        const safeItems = items ?? [];
        const newTotal = safeItems.reduce((sum, item) => {
            const itemPrice = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
            const itemQuantity = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity;
            if (!itemPrice || !itemQuantity || isNaN(itemPrice) || isNaN(itemQuantity) || itemQuantity <= 0) {
                return sum;
            }
            const itemTotal = itemPrice * itemQuantity;
            return sum + (isNaN(itemTotal) ? 0 : itemTotal);
        }, 0);

        const newItemCount = safeItems.reduce((sum, item) => {
            const itemQuantity = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity;
            return sum + (isNaN(itemQuantity) ? 0 : itemQuantity);
        }, 0);

        setTotal(newTotal);
        setItemCount(newItemCount);
    }, [items]);

    // Only persist cart state if session is defined and status !== 'loading'
    const persistCartState = useCallback((currentItems: CartItem[], currentPendingChanges: CartItem[] = []) => {
        if (!isClient || status === 'loading') return;
        if (typeof window !== 'undefined') {
            // Always persist cart for guests (unauthenticated), even if empty
            if (currentItems.length === 0 && status !== 'unauthenticated') {
                console.log('[Cart] Not persisting empty cart unless unauthenticated or explicit clear. Status:', status);
                return;
            }
            try {
                const cartState = {
                    items: Array.isArray(currentItems) ? currentItems : [],
                    pendingChanges: Array.isArray(currentPendingChanges) ? currentPendingChanges : [],
                    lastSynced: new Date().toISOString(),
                    version: '1.0',
                };
                console.log('[Cart] About to persist cartState:', cartState, 'Status:', status);
                localStorage.setItem('cartState', JSON.stringify(cartState));
                console.log('[Cart] Persisted cartState:', cartState);
            } catch (err) {
                console.error('[Cart] Failed to persist cartState:', err);
            }
        }
    }, [isClient, status]);

    // On mount or when status changes, load cart from localStorage for guests
    useEffect(() => {
        if (!isClient || status === 'loading') return;
        console.log('[Cart][DEBUG] Cart loading effect running. isClient:', isClient, 'status:', status);
        if (status === 'unauthenticated') {
            const cartState = loadCartState();
            console.log('[Cart][DEBUG] Loaded cartState from localStorage:', cartState);
            const validItems = Array.isArray(cartState?.items) ? cartState.items.filter(validateCartItem) : [];
            if (cartState && validItems.length !== (cartState.items?.length || 0)) {
                console.warn('[Cart] Cleaned up invalid items on mount:', cartState.items?.filter((item: any) => !validateCartItem(item)));
                persistCartState(validItems, []);
            }
            console.log('[Cart] About to setItems (mount):', validItems);
            setItems(validItems);
            setPendingChanges([]);
            setIsLoading(false); // Set loading to false after loading cart
            console.log('[Cart][DEBUG] isLoading set to false after loading cart');
            setCartLoaded(true);
            // Log loaded cart state
            console.log('[Cart] Loaded cartState on mount:', cartState);
            if (cartState && (cartState.items as any[])?.some((item: any) => !item.productId)) {
                console.warn('[Cart] Invalid items detected after load:', cartState.items);
                console.trace();
            }
        }
    }, [isClient, status, persistCartState]);

    // Sync cart with server
    const syncCart = useCallback(async (itemsToSync: CartItem[]) => {
        if (rateLimitCooldown) {
            setError("You're making changes too quickly. Please wait a moment and try again.");
            return;
        }
        try {
            setIsLoading(true);
            setError(null);

            // Filter out invalid items before mapping
            // Ensure all items have productId (fallback to id)
            const normalizedItems = itemsToSync.map(item => ({ ...item, productId: item.productId || item.id }));
            // Defensive: filter out items with missing/invalid productId
            const filteredItems = normalizedItems.filter(item => typeof item.productId === 'string' && !!item.productId);
            const validItems = filteredItems.filter(validateCartItem);
            if (validItems.length !== itemsToSync.length) {
                console.warn('[Cart] Skipping invalid cart items (failed validation):', itemsToSync.filter(item => !validateCartItem(item)));
            }
            const apiItems = validItems.map(item => ({
                id: item.productId,
                quantity: item.quantity,
                ...(typeof item.variantId === 'string' && item.variantId ? { variantId: item.variantId } : {}),
                ...(typeof item.stockAtAdd === 'number' ? { stockAtAdd: item.stockAtAdd } : {}),
            }));

            // Send guestId for guests, not for authenticated users
            const body: any = { items: apiItems };
            if (!session?.user && guestId) {
                body.guestId = guestId;
            }

            const response = await fetch('/api/cart/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    setError("You're making changes too quickly. Please wait a moment and try again.");
                    setRateLimitCooldown(true);
                    if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
                    cooldownTimeoutRef.current = setTimeout(() => {
                        setRateLimitCooldown(false);
                        setError(null);
                    }, RATE_LIMIT_COOLDOWN_MS);
                    return;
                }
                // Defensive: handle 404 with missingProducts
                if (response.status === 404) {
                    const errorBody = await response.json();
                    if (errorBody && Array.isArray(errorBody.missingProducts) && errorBody.missingProducts.length > 0) {
                        // Remove missing products from cart
                        const remainingItems = items.filter(item => !errorBody.missingProducts.includes(item.productId));
                        setItems(remainingItems);
                        setPendingChanges([]);
                        persistCartState(remainingItems, []);
                        setError('Some products in your cart are no longer available and have been removed.');
                        toast('Some products in your cart are no longer available and have been removed.', { icon: '⚠️' });
                        return;
                    }
                }
                // Log error response for debugging
                const errorBody = await response.text();
                console.error('Failed to sync cart. Response:', errorBody);
                throw new AppError('Failed to sync cart', response.status);
            }

            const data = await response.json() as { items?: CartItem[] };
            if (data && Array.isArray(data.items)) {
                // Ensure all items have productId (fallback to id)
                const normalizedServerItems = data.items.map(item => ({ ...item, productId: item.productId || item.id }));
                setItems(normalizedServerItems);
                setPendingChanges([]);
                persistCartState(normalizedServerItems, []);
            } else {
                console.error('[Cart] API response missing items array:', data);
            }
        } catch (err: any) {
            console.error('Failed to sync cart:', err);
            setError(err instanceof Error ? err.message : 'Failed to sync cart');
            // Only add to pendingChanges if not a 400/404 error
            const isClientError = typeof err === 'object' && err !== null && 'status' in err && (err.status === 400 || err.status === 404);
            if (!isClientError) {
                setPendingChanges(prev => [...prev, ...itemsToSync]);
            } else {
                console.error('[Cart] Not adding to pendingChanges due to client error:', err);
            }
        } finally {
            setIsLoading(false);
        }
    }, [session, persistCartState, rateLimitCooldown, items, guestId]);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        if (!isClient) return;
        try {
            persistCartState(items, pendingChanges);
            // Calculate total and item count
            const safeItems = items ?? [];
            const newTotal = safeItems.reduce((sum, item) => {
                const itemPrice = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
                const itemTotal = itemPrice * (item.quantity || 0);
                return sum + (isNaN(itemTotal) ? 0 : itemTotal);
            }, 0);
            const newItemCount = safeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
            setTotal(newTotal);
            setItemCount(newItemCount);
        } catch (err) {
            const { message } = handleApiError(err);
            setError(message);
            console.error("Error saving cart:", err);
        }
    }, [items, isClient, pendingChanges, persistCartState]);

    // Sync cart with server every 10 minutes, and immediately on login/mount
    useEffect(() => {
        if (!isClient || !session?.user) return;
        const shouldSync = (items && items.length > 0) || (pendingChanges && pendingChanges.length > 0);
        const now = Date.now();
        if (shouldSync) {
            if (now - lastSyncTimeRef.current > 5000) {
                console.log('[Cart][DEBUG] useEffect: Syncing cart on mount/login or interval. items:', items, 'pendingChanges:', pendingChanges, 'lastSyncTime:', lastSyncTimeRef.current);
                syncCart(items);
                lastSyncTimeRef.current = now;
            } else {
                console.log('[Cart][DEBUG] useEffect: Skipping sync (recent user-initiated sync). lastSyncTime:', lastSyncTimeRef.current);
            }
        } else {
            console.log('[Cart][DEBUG] useEffect: Not syncing cart (empty, no pending changes).');
        }
        if (shouldSync) {
            const interval = setInterval(() => {
                const now = Date.now();
                if (now - lastSyncTimeRef.current > 5000) {
                    console.log('[Cart][DEBUG] useEffect: Periodic sync. items:', items, 'pendingChanges:', pendingChanges, 'lastSyncTime:', lastSyncTimeRef.current);
                    syncCart(items);
                    lastSyncTimeRef.current = now;
                } else {
                    console.log('[Cart][DEBUG] useEffect: Skipping periodic sync (recent user-initiated sync). lastSyncTime:', lastSyncTimeRef.current);
                }
            }, 10 * 60 * 1000);
            return () => clearInterval(interval);
        }
        return undefined;
    }, [isClient, session?.user, items, pendingChanges, syncCart]);

    // Debug log at the start of updateQuantity
    const updateQuantity = useCallback(async (id: string, quantity: number, variantId?: string): Promise<void> => {
        if (rateLimitCooldown) {
            setError("You're making changes too quickly. Please wait a moment and try again.");
            return;
        }
        try {
            userInitiatedRef.current = true;
            const itemToUpdate = items.find(item => item.id === id && (!variantId || item.variantId === variantId));
            if (!itemToUpdate) return;

            const intendedQuantity = quantity;

            // Stock validation API call for single item
            try {
                const response = await fetch('/api/cart/validate-stock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: itemToUpdate.productId, variantId: itemToUpdate.variantId, quantity: intendedQuantity }),
                });
                if (!response.ok) {
                    setError('Failed to check stock');
                    return;
                }
                const data = await response.json();
                let stock = null;
                if (Array.isArray(data) && data.length > 0) {
                    stock = data[0].stock;
                } else if (data && typeof data.stock === 'number') {
                    stock = data.stock;
                }
                if (typeof stock === 'number' && intendedQuantity > stock) {
                    setError(`Only ${stock} items available in stock for "${itemToUpdate.name}"`);
                    return;
                }
            } catch (err) {
                setError('Failed to check stock');
                return;
            }

            // Only build and set updatedItems if stock check passes
            const updatedItems = items.map(item => {
                if (item.id === id && (!variantId || item.variantId === variantId)) {
                    return { ...item, quantity };
                }
                return item;
            });

            setItems(Array.isArray(updatedItems) ? updatedItems : []);
            persistCartState(Array.isArray(updatedItems) ? updatedItems : [], Array.isArray(pendingChanges) ? pendingChanges : []);
            debouncedSyncCart(Array.isArray(updatedItems) ? updatedItems : []);

            if (session?.user) {
                await syncCart(updatedItems);
            }
        } catch (err) {
            const { message } = handleApiError(err);
            setError(message);
            console.error("Error updating quantity:", err);
        }
    }, [items, pendingChanges, session, syncCart, rateLimitCooldown]);

    // Debug log at the start of addItem
    const addItem = useCallback(async (item: CartItemInput, quantity: number = 1): Promise<void> => {
        if (rateLimitCooldown) {
            setError("You're making changes too quickly. Please wait a moment and try again.");
            return;
        }
        try {
            userInitiatedRef.current = true;
            const newId = item.variantId ? `${item.productId}-${item.variantId}` : item.productId;
            const safeItems = Array.isArray(items) ? items : [];
            const existingItemIndex = safeItems.findIndex(
                i => i.productId === item.productId && i.variantId === item.variantId
            );
            let intendedQuantity = quantity;
            if (existingItemIndex >= 0) {
                intendedQuantity = safeItems[existingItemIndex].quantity + quantity;
            }
            // Stock validation API call for single item
            try {
                const response = await fetch('/api/cart/validate-stock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: item.productId, variantId: item.variantId, quantity: intendedQuantity }),
                });
                if (!response.ok) {
                    setError('Failed to check stock');
                    return;
                }
                const data = await response.json();
                let stock = null;
                if (Array.isArray(data) && data.length > 0) {
                    stock = data[0].stock;
                } else if (data && typeof data.stock === 'number') {
                    stock = data.stock;
                }
                if (typeof stock === 'number' && intendedQuantity > stock) {
                    setError(`Only ${stock} items available in stock for "${item.name}"`);
                    return;
                }
            } catch (err) {
                setError('Failed to check stock');
                return;
            }
            // If stock check passes, proceed to add/update item
            const newItem: CartItem = {
                id: newId,
                productId: item.productId,
                variantId: item.variantId,
                name: item.name,
                price: item.price,
                image: item.image,
                quantity,
                stock: item.stock
            };
            let updatedItems;
            if (existingItemIndex >= 0) {
                updatedItems = safeItems.map((i, idx) =>
                    idx === existingItemIndex
                        ? { ...i, quantity: i.quantity + quantity }
                        : i
                );
            } else {
                updatedItems = [...safeItems, newItem];
            }
            setItems(updatedItems);
            persistCartState(updatedItems, pendingChanges);
            debouncedSyncCart(updatedItems);
        } catch (err) {
            const { message } = handleApiError(err);
            setError(message);
            console.error("Error adding item:", err);
        }
    }, [items, pendingChanges, session, syncCart, rateLimitCooldown]);

    const removeItem = useCallback(async (id: string, variantId?: string): Promise<void> => {
        if (rateLimitCooldown) {
            setError("You're making changes too quickly. Please wait a moment and try again.");
            return;
        }
        try {
            userInitiatedRef.current = true;
            const updatedItems = items.filter(
                item => !(item.id === id && (!variantId || item.variantId === variantId))
            );

            setItems(Array.isArray(updatedItems) ? updatedItems : []);
            persistCartState(Array.isArray(updatedItems) ? updatedItems : [], Array.isArray(pendingChanges) ? pendingChanges : []);
            debouncedSyncCart(Array.isArray(updatedItems) ? updatedItems : []);

            if (session?.user) {
                await syncCart(updatedItems);
            }
        } catch (err) {
            const { message } = handleApiError(err);
            setError(message);
            console.error("Error removing item:", err);
        }
    }, [items, pendingChanges, session, syncCart, rateLimitCooldown]);

    // Helper to clear cart state and localStorage
    const clearCartAndStorage = useCallback(() => {
        setItems([]);
        setPendingChanges([]);
        if (isClient && typeof window !== 'undefined') {
            localStorage.removeItem('cartState');
            console.log('[Cart] Cleared cartState from localStorage');
        }
        cartQueue.clear();
    }, [isClient]);

    // Replace clearCart with clearCartAndStorage in logout/clear cart flows
    const clearCart = useCallback(() => {
        userInitiatedRef.current = true;
        clearCartAndStorage();
        debouncedSyncCart([]);
    }, [clearCartAndStorage]);

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

    const value = useMemo(
        () => ({
            items,
            addItem,
            removeItem,
            updateQuantity,
            clearCart,
            total,
            itemCount,
            error,
            clearError,
            isLoading,
            retrySync,
            pendingChanges
        }),
        [items, addItem, removeItem, updateQuantity, clearCart, total, itemCount, error, clearError, isLoading, retrySync, pendingChanges]
    );

    useEffect(() => {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('[CartContext] value on render:', value);
        console.log('[CartContext] session:', session, 'status:', status);
      }
    }, [value, session, status]);

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
                        console.error('[Cart] Failed to merge guest cart on login:', err);
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
                        console.error('[Cart] Attempted to setItems with non-array:', merged);
                        userInitiatedRef.current = false;
                        setItems([]);
                    } else {
                        userInitiatedRef.current = false;
                        setItems(merged);
                    }
                    persistCartState(Array.isArray(merged) ? merged : [], Array.isArray(pendingChanges) ? pendingChanges : []);
                    // Log merged cart state
                    console.log('[Cart] Merged cart state:', merged);
                    if ((merged as any[]).some((item: any) => !item.productId)) {
                        console.warn('[Cart] Invalid items detected after merge:', merged);
                        console.trace();
                    }
                    // Sync merged cart to server
                    if (session?.user) {
                        const validMerged = (Array.isArray(merged) ? merged : []).filter(validateCartItem);
                        if (validMerged.length !== (Array.isArray(merged) ? merged.length : 0)) {
                            console.warn('[Cart] Skipping invalid merged cart items (failed validation):', (Array.isArray(merged) ? merged : []).filter(item => !validateCartItem(item)));
                        }
                        const apiItems = validMerged.map(item => ({
                            id: item.productId,
                            quantity: item.quantity,
                            ...(typeof item.variantId === 'string' && item.variantId ? { variantId: item.variantId } : {}),
                            ...(typeof item.stockAtAdd === 'number' ? { stockAtAdd: item.stockAtAdd } : {}),
                        }));
                        await fetch('/api/cart/sync', {
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
            if (typeof window !== 'undefined') {
                console.log('[CartContext] Cleared cart after logout.');
            }
            previouslyAuthenticatedRef.current = false;
        }
    }, [isClient, status, clearCartAndStorage]);

    // Fallback: ensure isLoading never hangs forever
    useEffect(() => {
        if (isLoading) {
            const timeout = setTimeout(() => {
                setIsLoading(false);
                console.warn('[Cart][DEBUG] Fallback: isLoading forced to false after 3s');
            }, 3000);
            return () => clearTimeout(timeout);
        }
    }, [isLoading]);

    // On mount, load or generate guestId for guests
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

    // Add effect to load cart for authenticated users on mount/login
    useEffect(() => {
        if (!isClient || status !== 'authenticated' || cartLoaded) return;
        (async () => {
            try {
                const res = await fetch('/api/cart', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.items)) {
                        userInitiatedRef.current = false;
                        setItems(data.items);
                        setPendingChanges([]);
                        persistCartState(data.items, []);
                    }
                }
            } catch (err) {
                console.error('[Cart] Failed to load cart for authenticated user:', err);
            } finally {
                setCartLoaded(true);
            }
        })();
    }, [isClient, status, cartLoaded, persistCartState]);

    // Debounce syncCart and only call when items actually change and the update was user-initiated
    const debouncedSyncCart = useMemo(() => debounce((itemsToSync: CartItem[]) => {
        console.log('[Cart][DEBUG] debouncedSyncCart called. userInitiatedRef:', userInitiatedRef.current, 'items:', itemsToSync);
        if (session?.user && itemsToSync.length === 0) return; // Don't sync empty cart for authenticated users
        if (userInitiatedRef.current) {
            syncCart(itemsToSync);
            lastSyncTimeRef.current = Date.now();
            userInitiatedRef.current = false;
        }
    }, 1000), [syncCart, session]);

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
