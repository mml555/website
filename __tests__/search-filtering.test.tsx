import { render, screen, act } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Types
interface Product {
  id: string;
  name: string;
  category: string;
  tags: string[];
}
interface SearchContextType {
  results: Product[];
  search: (query: string) => void;
  fuzzySearch: (query: string) => void;
  autocomplete: (prefix: string) => string[];
  filter: (attr: Partial<Product>) => void;
  analytics: string[];
}

const SearchContext = React.createContext<SearchContextType | null>(null);
function useSearch() {
  const ctx = React.useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
function SearchProvider({ children }: { children: ReactNode }) {
  const [products] = useState<Product[]>([
    { id: '1', name: 'Widget', category: 'Gadgets', tags: ['blue', 'sale'] },
    { id: '2', name: 'Gizmo', category: 'Gadgets', tags: ['red'] },
    { id: '3', name: 'Thingamajig', category: 'Tools', tags: ['yellow'] }
  ]);
  const [results, setResults] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<string[]>([]);
  const search = (query: string) => {
    setAnalytics(a => [...a, query]);
    // Exact match
    setResults(products.filter(p => p.name.toLowerCase() === query.toLowerCase()));
  };
  const autocomplete = (prefix: string) => {
    return products.map(p => p.name).filter(name => name.toLowerCase().startsWith(prefix.toLowerCase()));
  };
  const filter = (attr: Partial<Product>) => {
    setResults(products.filter(p => {
      return Object.entries(attr).every(([k, v]) => {
        if (Array.isArray(p[k as keyof Product]) && Array.isArray(v)) {
          // tags
          return v.every(val => (p[k as keyof Product] as string[]).includes(val));
        }
        return p[k as keyof Product] === v;
      });
    }));
  };
  // Fuzzy search: contains substring
  const fuzzySearch = (query: string) => {
    setAnalytics(a => [...a, query]);
    setResults(products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())));
  };
  return (
    <SearchContext.Provider value={{ results, search, fuzzySearch, autocomplete, filter, analytics }}>
      {children}
    </SearchContext.Provider>
  );
}

function TestComponent() {
  const { results, search, fuzzySearch, autocomplete, filter, analytics } = useSearch();
  return (
    <div>
      <button onClick={() => search('Widget')}>Exact Widget</button>
      <button onClick={() => search('Gizmo')}>Exact Gizmo</button>
      <button onClick={() => filter({ category: 'Gadgets' })}>Filter Gadgets</button>
      <button onClick={() => filter({ tags: ['blue'] })}>Filter Blue</button>
      <button onClick={() => filter({ tags: ['red'] })}>Filter Red</button>
      <button onClick={() => filter({ category: 'Tools' })}>Filter Tools</button>
      <button onClick={() => fuzzySearch('Wid')}>Fuzzy Wid</button>
      <div data-testid="result-names">{results.map(r => r.name).join(',')}</div>
      <div data-testid="autocomplete">{autocomplete('Wi').join(',')}</div>
      <div data-testid="analytics">{analytics.join(',')}</div>
    </div>
  );
}

describe('Search & Filtering', () => {
  it('should return results for exact matches', async () => {
    render(<SearchProvider><TestComponent /></SearchProvider>);
    await act(async () => {
      screen.getByText('Exact Widget').click();
    });
    expect(screen.getByTestId('result-names').textContent).toBe('Widget');
    await act(async () => {
      screen.getByText('Exact Gizmo').click();
    });
    expect(screen.getByTestId('result-names').textContent).toBe('Gizmo');
  });

  it('should support fuzzy search and autocomplete', async () => {
    render(<SearchProvider><TestComponent /></SearchProvider>);
    // Fuzzy search: simulate by calling search with partial
    await act(async () => {
      screen.getByText('Fuzzy Wid').click();
    });
    // Fuzzy search should match Widget
    expect(screen.getByTestId('result-names').textContent).toContain('Widget');
    // Autocomplete
    expect(screen.getByTestId('autocomplete').textContent).toContain('Widget');
  });

  it('should filter products by attribute', async () => {
    render(<SearchProvider><TestComponent /></SearchProvider>);
    await act(async () => {
      screen.getByText('Filter Gadgets').click();
    });
    expect(screen.getByTestId('result-names').textContent).toContain('Widget');
    expect(screen.getByTestId('result-names').textContent).toContain('Gizmo');
    await act(async () => {
      screen.getByText('Filter Blue').click();
    });
    expect(screen.getByTestId('result-names').textContent).toContain('Widget');
    await act(async () => {
      screen.getByText('Filter Red').click();
    });
    expect(screen.getByTestId('result-names').textContent).toContain('Gizmo');
    await act(async () => {
      screen.getByText('Filter Tools').click();
    });
    expect(screen.getByTestId('result-names').textContent).toContain('Thingamajig');
  });

  it('should track search analytics', async () => {
    render(<SearchProvider><TestComponent /></SearchProvider>);
    await act(async () => {
      screen.getByText('Exact Widget').click();
      screen.getByText('Exact Gizmo').click();
    });
    expect(screen.getByTestId('analytics').textContent).toContain('Widget');
    expect(screen.getByTestId('analytics').textContent).toContain('Gizmo');
  });
}); 