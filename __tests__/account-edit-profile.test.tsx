/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditProfilePage from '../app/account/edit/page';
import React from 'react';
import userEvent from '@testing-library/user-event';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: { user: { id: 'user1', email: 'test@example.com', name: 'Test User' } }, status: 'authenticated' }))
}));

global.fetch = jest.fn();

function renderWithCartProvider(ui: React.ReactElement) {
  return render(ui);
}

describe('EditProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation((url, options) => {
      if (url === '/api/user/profile') {
        if (options && options.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => ({ name: 'Test User', email: 'test@example.com' }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ name: 'Test User', email: 'test@example.com' }) });
      }
      if (url === '/api/cart') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('shows loading spinner while fetching', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    renderWithCartProvider(<EditProfilePage />);
    expect(screen.getByText(/Loading profile/i)).toBeInTheDocument();
  });

  it('shows form with user data', async () => {
    renderWithCartProvider(<EditProfilePage />);
    expect(await screen.findByDisplayValue('Test User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('handles API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'fail' }) });
    renderWithCartProvider(<EditProfilePage />);
    expect(await screen.findByText(/fail/i)).toBeInTheDocument();
  });

  it('handles successful update', async () => {
    renderWithCartProvider(<EditProfilePage />);
    const nameInput = await screen.findByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    const saveButton = await screen.findByRole('button', { name: /Save Changes/i });
    await userEvent.click(saveButton);
    await waitFor(() => {
      expect(screen.getByText(/Profile updated/i)).toBeInTheDocument();
    });
  });
});

describe('Minimal form submit', () => {
  it('calls onSubmit when submit button is clicked', async () => {
    const handleSubmit = jest.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit}>
        <input name="test" />
        <button type="submit">Submit</button>
      </form>
    );
    const button = await screen.findByRole('button', { name: /submit/i });
    await userEvent.click(button);
    expect(handleSubmit).toHaveBeenCalled();
  });
}); 