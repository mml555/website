# Minimal Reproduction: Next.js App Router Dynamic Params Bug

## Environment
- **Next.js version:** 15.3.2 (but also affects some other 15.x versions)
- **Node version:** (your version here)
- **OS:** (your OS here)

## Problem
When using a dynamic route in the App Router (e.g. `/orders/[orderId]`), even with the correct async usage, Next.js throws:

```
Error: Route "/orders/[orderId]" used `params.orderId`. `params` should be awaited before using its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
```

## Minimal Reproduction

### 1. Directory Structure
```
app/
  orders/
    [orderId]/
      page.tsx
```

### 2. `app/orders/[orderId]/page.tsx`
```tsx
export default async function OrderDetailsPage({ params }: { params: { orderId: string } }) {
  // Correct usage: params is synchronous in app directory
  return <div>Order ID: {params.orderId}</div>;
}
```

### 3. Steps to Reproduce
1. Start the dev server: `npm run dev`
2. Visit `/orders/123` in your browser
3. Observe the error in the terminal and browser:

```
Error: Route "/orders/[orderId]" used `params.orderId`. `params` should be awaited before using its properties.
```

## Expected Behavior
- The page should render and display `Order ID: 123`.
- No error about awaiting params should occur when using the correct function signature and usage.

## Actual Behavior
- Next.js throws an error, even though the code is correct.

## Notes
- No `await` is used on `params` or `params.orderId`.
- The error persists after clearing `.next` and restarting the dev server.
- This may be a regression or bug in recent Next.js versions.

## Additional Info
- If you change the route to a static route (e.g. `/orders/static.tsx`), the error disappears.
- The same error can occur for other dynamic routes (e.g. `[slug]`, `[id]`, etc.)

---

**Please investigate and advise if there is a workaround or if this is a known bug.** 