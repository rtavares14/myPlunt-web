import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  hasGoogleLink: boolean;
  hasAppleLink: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<string | null>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const refreshUser = async (): Promise<string | null> => {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setToken(null);
      setUser(null);
      tokenRef.current = null;
      return null;
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    // Update the ref synchronously so authFetch's retry path sees the fresh token
    // without waiting for React to flush the state update.
    tokenRef.current = data.token;
    return data.token;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshUser();
      } catch {
        // stay logged out
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore — clear local state regardless
    }
    setToken(null);
    setUser(null);
  };

  /**
   * Fetch wrapper that adds the current access token and transparently retries
   * once after a silent refresh if the server returns 401.
   */
  const authFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const withAuth = (t: string | null): RequestInit => ({
      ...init,
      credentials: 'include',
      headers: {
        ...(init.headers ?? {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });

    const first = await fetch(input, withAuth(tokenRef.current));
    if (first.status !== 401) return first;

    const refreshed = await refreshUser();
    if (!refreshed) return first;
    return fetch(input, withAuth(refreshed));
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, refreshUser, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
