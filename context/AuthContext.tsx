import React, { createContext, useContext, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status } = useSession();

  const value = {
    isAuthenticated: status === 'authenticated',
    user: session?.user || null,
    loading: status === 'loading',
  };

  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[AuthContext] value on render:', value);
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 