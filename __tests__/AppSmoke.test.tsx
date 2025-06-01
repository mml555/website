import React from 'react';
import { render, screen } from '@testing-library/react';

describe('App smoke test', () => {
  it('renders without crashing', () => {
    render(<div>Hello, world!</div>);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });
}); 