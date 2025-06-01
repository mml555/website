# 🧪 Manual QA Checklist

## Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome on Android

## Core Flows
- [ ] User registration, login, logout
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Add to cart, update quantity, remove from cart
- [ ] Guest checkout (no login)
- [ ] Authenticated checkout (logged in)
- [ ] Payment (Stripe test mode)
- [ ] Order confirmation page
- [ ] Order history (user)
- [ ] Wishlist add/remove/view
- [ ] Admin: product CRUD
- [ ] Admin: category CRUD
- [ ] Admin: order management
- [ ] Search and filter products
- [ ] Pagination (products, orders)
- [ ] Responsive layout (desktop, tablet, mobile)

## Edge Cases
- [ ] Invalid login credentials
- [ ] Expired/invalid email verification link
- [ ] Expired/invalid password reset link
- [ ] Out-of-stock product add to cart
- [ ] Attempt checkout with empty cart
- [ ] Attempt duplicate product creation (admin)
- [ ] API returns 500 error (simulate)
- [ ] Network error during checkout
- [ ] Large order (10+ items)
- [ ] Slow network (throttle in dev tools)

## Accessibility
- [ ] All forms are keyboard accessible
- [ ] Images have alt text
- [ ] Sufficient color contrast
- [ ] Focus indicators visible

## Performance
- [ ] Home page loads < 2s on fast connection
- [ ] Product page loads < 2s
- [ ] Checkout page loads < 2s

---
- [ ] All tests above passed
- [ ] Issues found are documented 