import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { AuthProvider } from '@/context/AuthContext';
import LoginForm from '@/components/auth/LoginForm';
import { act } from 'react';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

describe('Authentication', () => {
  beforeEach(() => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });
  });

  describe('LoginForm', () => {
    it('renders login form correctly', () => {
      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('handles form submission', async () => {
      const mockSignIn = signIn as jest.Mock;
      mockSignIn.mockResolvedValueOnce({ ok: true });

      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/email/i), {
          target: { value: 'test@example.com' },
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
          target: { value: 'password123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      });

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'test@example.com',
          password: 'password123',
          redirect: false,
        });
      });
    });

    it('displays error message on failed login', async () => {
      const mockSignIn = signIn as jest.Mock;
      mockSignIn.mockResolvedValueOnce({ error: 'Invalid credentials' });

      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/email/i), {
          target: { value: 'test@example.com' },
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
          target: { value: 'wrongpassword' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('handles sign out', async () => {
      const mockSignOut = signOut as jest.Mock;
      mockSignOut.mockResolvedValueOnce(undefined);

      render(
        <AuthProvider>
          <button onClick={() => signOut()}>Sign Out</button>
        </AuthProvider>
      );

      await act(async () => {
        fireEvent.click(screen.getByText(/sign out/i));
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('displays user information when authenticated', () => {
      (useSession as jest.Mock).mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
          },
        },
        status: 'authenticated',
      });

      render(
        <AuthProvider>
          <div data-testid="user-info">
            {useSession().data?.user?.name}
          </div>
        </AuthProvider>
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });
}); 