import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

function ProductList() {
  return (
    <ul aria-label="Product List">
      <li tabIndex={0}>Widget</li>
      <li tabIndex={0}>Gizmo</li>
    </ul>
  );
}
function Cart() {
  return (
    <section aria-label="Shopping Cart">
      <h2>Cart</h2>
      <button aria-label="Remove item">Remove</button>
      <button aria-label="Checkout">Checkout</button>
    </section>
  );
}
function Checkout() {
  return (
    <form aria-label="Checkout Form">
      <label htmlFor="address">Address</label>
      <input id="address" name="address" />
      <button type="submit">Pay</button>
    </form>
  );
}
function AdminDashboard() {
  return (
    <main aria-label="Admin Dashboard">
      <nav aria-label="Admin Navigation">
        <a href="#orders">Orders</a>
        <a href="#products">Products</a>
      </nav>
      <section aria-label="Reports">
        <h2>Reports</h2>
      </section>
    </main>
  );
}
function Modal({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Sample Modal">
      <h2>Modal Title</h2>
      <button aria-label="Close">Close</button>
    </div>
  );
}

describe('Accessibility (a11y)', () => {
  it('Product list has no accessibility violations', async () => {
    const { container } = render(<ProductList />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  it('Cart has no accessibility violations', async () => {
    const { container } = render(<Cart />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  it('Checkout has no accessibility violations', async () => {
    const { container } = render(<Checkout />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  it('Admin dashboard has no accessibility violations', async () => {
    const { container } = render(<AdminDashboard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  it('Modal/dialog has no accessibility violations when open', async () => {
    const { container } = render(<Modal open={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
}); 