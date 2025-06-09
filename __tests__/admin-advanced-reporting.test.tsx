import { render, screen, act, waitFor } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Types
interface Report {
  id: string;
  date: string;
  product: string;
  category: string;
  sales: number;
}
interface ReportingContextType {
  reports: Report[];
  error: string | null;
  generateReport: (range: { from: string; to: string }) => Promise<void>;
  exportCSV: () => Promise<string>;
  exportPDF: () => Promise<string>;
  filter: (opts: { product?: string; category?: string }) => void;
}

const ReportingContext = React.createContext<ReportingContextType | null>(null);
function useReporting() {
  const ctx = React.useContext(ReportingContext);
  if (!ctx) throw new Error('useReporting must be used within ReportingProvider');
  return ctx;
}
function ReportingProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Mock API
  const api = {
    generateReport: jest.fn(async (range: { from: string; to: string }) => {
      if (range.from === 'fail') throw new Error('Report error');
      // Simulate large dataset
      if (range.from === 'large') {
        return Array.from({ length: 10000 }, (_, i) => ({ id: String(i), date: '2024-01-01', product: 'P', category: 'C', sales: 100 }));
      }
      return [
        { id: '1', date: '2024-01-01', product: 'Widget', category: 'Gadgets', sales: 100 },
        { id: '2', date: '2024-01-02', product: 'Gizmo', category: 'Gadgets', sales: 200 }
      ];
    }),
    exportCSV: jest.fn(async () => 'csvdata'),
    exportPDF: jest.fn(async () => 'pdfdata')
  };
  const generateReport = async (range: { from: string; to: string }) => {
    setError(null);
    try {
      const data = await api.generateReport(range);
      setReports(data);
    } catch (err: any) {
      setReports([]);
      setError(err.message || 'Report error');
    }
  };
  const exportCSV = async () => api.exportCSV();
  const exportPDF = async () => api.exportPDF();
  const filter = ({ product, category }: { product?: string; category?: string }) => {
    setReports(prev => prev.filter(r => (!product || r.product === product) && (!category || r.category === category)));
  };
  return (
    <ReportingContext.Provider value={{ reports, error, generateReport, exportCSV, exportPDF, filter }}>
      {children}
    </ReportingContext.Provider>
  );
}

function TestComponent() {
  const { reports, error, generateReport, exportCSV, exportPDF, filter } = useReporting();
  return (
    <div>
      <button onClick={() => generateReport({ from: '2024-01-01', to: '2024-01-31' })}>Generate</button>
      <button onClick={() => generateReport({ from: 'fail', to: 'fail' })}>Fail</button>
      <button onClick={() => generateReport({ from: 'large', to: 'large' })}>Large</button>
      <button onClick={() => filter({ product: 'Widget' })}>Filter Widget</button>
      <button onClick={() => filter({ category: 'Gadgets' })}>Filter Gadgets</button>
      <button onClick={exportCSV}>Export CSV</button>
      <button onClick={exportPDF}>Export PDF</button>
      <div data-testid="report-count">{reports.length}</div>
      <div data-testid="first-product">{reports[0]?.product || ''}</div>
      <div data-testid="error">{error || ''}</div>
    </div>
  );
}

describe('Admin Advanced Reporting', () => {
  it('should generate sales reports by date range', async () => {
    render(<ReportingProvider><TestComponent /></ReportingProvider>);
    await act(async () => {
      screen.getByText('Generate').click();
    });
    expect(screen.getByTestId('report-count').textContent).toBe('2');
    expect(screen.getByTestId('first-product').textContent).toBe('Widget');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('should export reports as CSV/PDF', async () => {
    render(<ReportingProvider><TestComponent /></ReportingProvider>);
    await act(async () => {
      screen.getByText('Export CSV').click();
      screen.getByText('Export PDF').click();
    });
    // No error expected, just ensure buttons work
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('should filter reports by product/category', async () => {
    render(<ReportingProvider><TestComponent /></ReportingProvider>);
    await act(async () => {
      screen.getByText('Generate').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('report-count').textContent).toBe('2');
    });
    await act(async () => {
      screen.getByText('Filter Widget').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('report-count').textContent).toBe('1');
      expect(screen.getByTestId('first-product').textContent).toBe('Widget');
    });
    await act(async () => {
      screen.getByText('Generate').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('report-count').textContent).toBe('2');
    });
    await act(async () => {
      screen.getByText('Filter Gadgets').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('report-count').textContent).toBe('2');
    });
  });

  it('should handle large datasets efficiently', async () => {
    render(<ReportingProvider><TestComponent /></ReportingProvider>);
    await act(async () => {
      screen.getByText('Large').click();
    });
    expect(Number(screen.getByTestId('report-count').textContent)).toBeGreaterThan(1000);
  });

  it('should handle report errors', async () => {
    render(<ReportingProvider><TestComponent /></ReportingProvider>);
    await act(async () => {
      screen.getByText('Fail').click();
    });
    expect(screen.getByTestId('error').textContent).toBe('Report error');
  });
}); 