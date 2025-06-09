import { render, screen, act, cleanup } from '@testing-library/react';
import React, { useState, ReactNode, useEffect } from 'react';

// Types
interface FilterConfig {
  name: string;
  config: Record<string, any>;
}
interface SavedFiltersContextType {
  savedFilters: FilterConfig[];
  saveFilter: (name: string, config: Record<string, any>) => void;
  loadFilter: (name: string) => Record<string, any> | undefined;
}

const SavedFiltersContext = React.createContext<SavedFiltersContextType | null>(null);
function useSavedFilters() {
  const ctx = React.useContext(SavedFiltersContext);
  if (!ctx) throw new Error('useSavedFilters must be used within SavedFiltersProvider');
  return ctx;
}
function SavedFiltersProvider({ children }: { children: ReactNode }) {
  const [savedFilters, setSavedFilters] = useState<FilterConfig[]>([]);
  useEffect(() => {
    const raw = localStorage.getItem('adminSavedFilters');
    if (raw) setSavedFilters(JSON.parse(raw));
  }, []);
  useEffect(() => {
    localStorage.setItem('adminSavedFilters', JSON.stringify(savedFilters));
  }, [savedFilters]);
  const saveFilter = (name: string, config: Record<string, any>) => {
    setSavedFilters(prev => {
      const filtered = prev.filter(f => f.name !== name);
      return [...filtered, { name, config }];
    });
  };
  const loadFilter = (name: string) => {
    return savedFilters.find(f => f.name === name)?.config;
  };
  return (
    <SavedFiltersContext.Provider value={{ savedFilters, saveFilter, loadFilter }}>
      {children}
    </SavedFiltersContext.Provider>
  );
}

function TestComponent() {
  const { savedFilters, saveFilter, loadFilter } = useSavedFilters();
  return (
    <div>
      <button onClick={() => saveFilter('Recent Orders', { status: 'recent', sort: 'desc' })}>Save Recent</button>
      <button onClick={() => saveFilter('High Value', { minTotal: 1000 })}>Save High Value</button>
      <button onClick={() => saveFilter('Recent Orders', { status: 'recent', sort: 'asc' })}>Overwrite Recent</button>
      <button onClick={() => loadFilter('Recent Orders')}>Load Recent</button>
      <div data-testid="filter-count">{savedFilters.length}</div>
      <div data-testid="recent-sort">{loadFilter('Recent Orders')?.sort || ''}</div>
      <div data-testid="high-value">{loadFilter('High Value')?.minTotal || ''}</div>
    </div>
  );
}

describe('Admin Saved Filters', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('should allow admin to save a filter configuration', async () => {
    render(<SavedFiltersProvider><TestComponent /></SavedFiltersProvider>);
    await act(async () => {
      screen.getByText('Save Recent').click();
      screen.getByText('Save High Value').click();
    });
    expect(screen.getByTestId('filter-count').textContent).toBe('2');
    expect(screen.getByTestId('recent-sort').textContent).toBe('desc');
    expect(screen.getByTestId('high-value').textContent).toBe('1000');
  });

  it('should allow admin to load a saved filter', async () => {
    render(<SavedFiltersProvider><TestComponent /></SavedFiltersProvider>);
    await act(async () => {
      screen.getByText('Save Recent').click();
    });
    expect(screen.getByTestId('recent-sort').textContent).toBe('desc');
  });

  it('should persist saved filters across sessions', async () => {
    render(<SavedFiltersProvider><TestComponent /></SavedFiltersProvider>);
    await act(async () => {
      screen.getByText('Save Recent').click();
    });
    cleanup();
    render(<SavedFiltersProvider><TestComponent /></SavedFiltersProvider>);
    expect(screen.getByTestId('recent-sort').textContent).toBe('desc');
  });

  it('should overwrite existing filter with same name', async () => {
    render(<SavedFiltersProvider><TestComponent /></SavedFiltersProvider>);
    await act(async () => {
      screen.getByText('Save Recent').click();
      screen.getByText('Overwrite Recent').click();
    });
    expect(screen.getByTestId('recent-sort').textContent).toBe('asc');
    expect(screen.getByTestId('filter-count').textContent).toBe('1');
  });
}); 