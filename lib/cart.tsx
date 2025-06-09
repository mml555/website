"use client";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { useSession } from "next-auth/react";
import debounce from 'lodash/debounce';
import { handleApiError } from '@/lib/AppUtils';
import type { CartItem } from '../types/product';
import {
  loadCartState,
  validateCartItem,
  cartQueue
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
    cartExpiryWarning: string | null;
    // Cart sharing methods
    generateShareableCartLink: () => Promise<string | null>;
    loadSharedCart: (shareId: string) => Promise<boolean>;
    // Save for later
    savedForLater: CartItem[];
    moveToSaveForLater: (id: string, variantId?: string) => void;
    moveToCartFromSaveForLater: (id: string, variantId?: string) => void;
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
    // TODO: Add cart sharing logic (UI, API integration)
    // TODO: Add save for later logic (UI, state management, persistence)
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
    // Guest cart expiry warning
    const [cartExpiryWarning, setCartExpiryWarning] = useState<string | null>(null);
    // --- Save for Later ---
    const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);

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

    // Keep itemsRef in sync with items state
    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    // Set isClient to true when component mounts
    useEffect(() => {
        setIsClient(true);
    }, []);

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
                return;
            }
            try {
                const cartState = {
                    items: Array.isArray(currentItems) ? currentItems : [],
                    pendingChanges: Array.isArray(currentPendingChanges) ? currentPendingChanges : [],
                    lastSynced: new Date().toISOString(),
                    version: '1.0',
                };
                localStorage.setItem('cartState', JSON.stringify(cartState));
            } catch (err) {
            }
        }
    }, [isClient, status]);

    // On mount or when status changes, load cart from localStorage for guests
    useEffect(() => {
        if (!isClient || status === 'loading') return;
        if (status === 'unauthenticated') {
            const cartState = loadCartState();
            const validItems = Array.isArray(cartState?.items) ? cartState.items.filter(validateCartItem) : [];
            if (cartState && validItems.length !== (cartState.items?.length || 0)) {
                persistCartState(validItems, []);
            }
            setItems(validItems);
            setPendingChanges([]);
            setIsLoading(false); // Set loading to false after loading cart
            setCartLoaded(true);
            if (cartState && (cartState.items as any[])?.some((item: any) => !item.productId)) {
            }
        }
    }, [isClient, status, persistCartState]);

    // Sync cart with server
    const syncCart = useCallback(async (itemsToSync: CartItem[]) => {
        if (rateLimitCooldown) {
            setError("You're making changes too quickly. Please wait a moment and try again.");
            toast.error("You're making changes too quickly. Please wait a moment and try again.");
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
                    toast.error("You're making changes too quickly. Please wait a moment and try again.");
                    setRateLimitCooldown(true);
                    if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
                    cooldownTimeoutRef.current = setTimeout(() => {
                        setRateLimitCooldown(false);
                        setError(null);
                    }, RATE_LIMIT_COOLDOWN_MS);
                    return;
                }
                if (response.status === 404) {
                    let errorBody: any = {};
                    try {
                        errorBody = await response.json();
                    } catch {
                        errorBody = {};
                    }
                    if (errorBody && Array.isArray(errorBody.missingProducts) && errorBody.missingProducts.length > 0) {
                        const remainingItems = items.filter(item => !errorBody.missingProducts.includes(item.productId));
                        setItems(remainingItems);
                        setPendingChanges([]);
                        persistCartState(remainingItems, []);
                        setError('Some products in your cart are no longer available and have been removed.');
                        toast('Some products in your cart are no longer available and have been removed.', { icon: '⚠️' });
                        return;
                    }
                }
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch {
                    errorText = 'Unknown error';
                }
                setError('Failed to sync cart: ' + errorText);
                toast.error('Failed to sync cart: ' + errorText);
                throw new AppError(errorText || 'Failed to sync cart', response.status);
            }

            const data = await response.json() as { items?: CartItem[] };
            if (data && Array.isArray(data.items)) {
                // Ensure all items have productId (fallback to id)
                const normalizedServerItems = data.items.map(item => ({ ...item, productId: item.productId || item.id }));
                setItems(normalizedServerItems);
                setPendingChanges([]);
                persistCartState(normalizedServerItems, []);
            } else {
            }
        } catch (err: any) {
            console.error('Failed to sync cart:', err);
            setError(err instanceof Error ? err.message : 'Failed to sync cart');
            toast.error(err instanceof Error ? err.message : 'Failed to sync cart');
            const isClientError = typeof err === 'object' && err !== null && 'status' in err && (err.status === 400 || err.status === 404);
            if (!isClientError) {
                setPendingChanges(prev => [...prev, ...itemsToSync]);
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
        }
    }, [items, isClient, pendingChanges, persistCartState]);

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

    // Debounce syncCart and only call when items actually change and the update was user-initiated
    const debouncedSyncCart = useMemo(() => debounce((itemsToSync: CartItem[]) => {
        if (session?.user && itemsToSync.length === 0) return; // Don't sync empty cart for authenticated users
        if (userInitiatedRef.current) {
            syncCart(itemsToSync);
            lastSyncTimeRef.current = Date.now();
            userInitiatedRef.current = false;
        }
    }, 1000), [syncCart, session]);

    // Debug log at the start of updateQuantity
    const updateQuantity = useCallback(async (id: string, quantity: number, variantId?: string): Promise<void> => {
        if (rateLimitCooldown) {
            setError("You're making changes too quickly. Please wait a moment and try again.");
            return;
        }
        try {
            userInitiatedRef.current = true;
            let updatedItems;
            if (quantity === 0) {
                updatedItems = items.filter(item => !(item.id === id && (!variantId || item.variantId === variantId)));
            } else {
                updatedItems = items.map(item => {
                    if (item.id === id && (!variantId || item.variantId === variantId)) {
                        return { ...item, quantity };
                    }
                    return item;
                });
            }
            setItems(Array.isArray(updatedItems) ? updatedItems : []);
            persistCartState(Array.isArray(updatedItems) ? updatedItems : [], Array.isArray(pendingChanges) ? pendingChanges : []);
            debouncedSyncCart(Array.isArray(updatedItems) ? updatedItems : []);
            if (session?.user) {
                syncCart(updatedItems);
            }
        } catch (err) {
            const { message } = handleApiError(err);
            setError(message);
        }
    }, [items, pendingChanges, session, syncCart, rateLimitCooldown, debouncedSyncCart, persistCartState]);

    // Debug log at the start of addItem
    const addItem = useCallback(async (item: CartItemInput, quantity: number = 1): Promise<void> => {
        if (rateLimitCooldown) {
            setError("You're making changes too quickly. Please wait a moment and try again.");
            return;
        }
        try {
            userInitiatedRef.current = true;
            const safeItems = Array.isArray(items) ? items : [];
            // Use both id and variantId for uniqueness
            const existingItemIndex = safeItems.findIndex(
                i => i.productId === item.productId && i.variantId === item.variantId
            );
            const newId = item.variantId ? `${item.productId}-${item.variantId}` : item.productId;
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
        }
    }, [items, pendingChanges, rateLimitCooldown, debouncedSyncCart, persistCartState]);

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
                syncCart(updatedItems);
            }
        } catch (err) {
            const { message } = handleApiError(err);
            setError(message);
        }
    }, [items, pendingChanges, rateLimitCooldown, debouncedSyncCart, persistCartState, session?.user, syncCart]);

    // --- Wrap cart mutations ---
    const atomicAddItem = useCallback(async (item: CartItemInput, quantity: number = 1) => {
        return new Promise<void>((resolve, reject) => {
            enqueueMutation(async () => {
                try {
                    await addItem(item, quantity);
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
    const clearCart = useCallback(() => {
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
            setError('Cannot share an empty cart.');
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
            setError('Failed to generate shareable cart link.');
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
            setError('Failed to load shared cart.');
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
            } finally {
                setCartLoaded(true);
            }
        })();
    }, [isClient, status, cartLoaded, persistCartState]);

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
