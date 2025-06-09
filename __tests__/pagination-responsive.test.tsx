import { render, screen, act } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Types
interface Item {
  id: string;
  name: string;
}
interface PaginationContextType {
  items: Item[];
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  paginated: Item[];
}

const PaginationContext = React.createContext<PaginationContextType | null>(null);
function usePagination() {
  const ctx = React.useContext(PaginationContext);
  if (!ctx) throw new Error('usePagination must be used within PaginationProvider');
  return ctx;
}
function PaginationProvider({ children, itemsPerPage = 4 }: { children: ReactNode; itemsPerPage?: number }) {
  const [items] = useState<Item[]>(Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), name: `Item ${i + 1}` })));
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginated = items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  return (
    <PaginationContext.Provider value={{ items, page, totalPages, setPage, paginated }}>
      {children}
    </PaginationContext.Provider>
  );
}

function TestComponent() {
  const { paginated, page, totalPages, setPage } = usePagination();
  // Responsive: show different text based on window width
  const [width, setWidth] = useState(window.innerWidth);
  React.useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  let device = 'desktop';
  if (width < 600) device = 'mobile';
  else if (width < 900) device = 'tablet';
  return (
    <div>
      <div data-testid="device">{device}</div>
      <div data-testid="page">{page}</div>
      <div data-testid="total-pages">{totalPages}</div>
      <div data-testid="items">{paginated.map(i => i.name).join(',')}</div>
      <button onClick={() => setPage(page - 1)} disabled={page === 1}>Prev</button>
      <button onClick={() => setPage(page + 1)} disabled={page === totalPages}>Next</button>
    </div>
  );
}

describe('Pagination & Responsive Layout', () => {
  it('should paginate product lists', async () => {
    render(<PaginationProvider itemsPerPage={3}><TestComponent /></PaginationProvider>);
    expect(screen.getByTestId('items').textContent).toBe('Item 1,Item 2,Item 3');
    expect(screen.getByTestId('page').textContent).toBe('1');
    await act(async () => {
      screen.getByText('Next').click();
    });
    expect(screen.getByTestId('items').textContent).toBe('Item 4,Item 5,Item 6');
    expect(screen.getByTestId('page').textContent).toBe('2');
    await act(async () => {
      screen.getByText('Next').click();
    });
    expect(screen.getByTestId('items').textContent).toBe('Item 7,Item 8,Item 9');
    expect(screen.getByTestId('page').textContent).toBe('3');
    await act(async () => {
      screen.getByText('Next').click();
    });
    expect(screen.getByTestId('items').textContent).toBe('Item 10');
    expect(screen.getByTestId('page').textContent).toBe('4');
    await act(async () => {
      screen.getByText('Prev').click();
    });
    expect(screen.getByTestId('items').textContent).toBe('Item 7,Item 8,Item 9');
    expect(screen.getByTestId('page').textContent).toBe('3');
  });

  it('should paginate order lists', async () => {
    render(<PaginationProvider itemsPerPage={5}><TestComponent /></PaginationProvider>);
    expect(screen.getByTestId('items').textContent).toBe('Item 1,Item 2,Item 3,Item 4,Item 5');
    expect(screen.getByTestId('page').textContent).toBe('1');
    await act(async () => {
      screen.getByText('Next').click();
    });
    expect(screen.getByTestId('items').textContent).toBe('Item 6,Item 7,Item 8,Item 9,Item 10');
    expect(screen.getByTestId('page').textContent).toBe('2');
  });

  it('should render correctly on desktop, tablet, and mobile', async () => {
    render(<PaginationProvider><TestComponent /></PaginationProvider>);
    // Desktop
    act(() => { window.innerWidth = 1200; window.dispatchEvent(new Event('resize')); });
    expect(screen.getByTestId('device').textContent).toBe('desktop');
    // Tablet
    act(() => { window.innerWidth = 800; window.dispatchEvent(new Event('resize')); });
    expect(screen.getByTestId('device').textContent).toBe('tablet');
    // Mobile
    act(() => { window.innerWidth = 500; window.dispatchEvent(new Event('resize')); });
    expect(screen.getByTestId('device').textContent).toBe('mobile');
  });
}); 