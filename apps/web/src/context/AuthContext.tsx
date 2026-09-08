import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi, getAuthToken, setAuthToken } from '../config';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string | Date;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function parseResponse(res: Response): Promise<{ ok: boolean; data: any; error?: string }> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      return { ok: res.ok, data, error: data?.error || data?.message };
    } catch {
      return { ok: false, data: null, error: 'Malformed JSON response from server' };
    }
  }

  // If response is HTML (Vercel SPA rewrite fallback, Render 502/503 cold start, or 404 page)
  const text = await res.text().catch(() => '');
  if (text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
    return {
      ok: false,
      data: null,
      error: 'Backend API service is starting up on Render (free tier cold-start). Please try again in 15 seconds.'
    };
  }

  return {
    ok: false,
    data: null,
    error: text || `Server returned status ${res.status}`
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('vibeguard_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session against API on mount
  useEffect(() => {
    const checkAuth = async () => {
      const currentToken = getAuthToken();
      if (!currentToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetchApi('/api/auth/me');
        if (res.ok) {
          const parsed = await parseResponse(res);
          if (parsed.data?.user) {
            setUser(parsed.data.user);
            localStorage.setItem('vibeguard_user', JSON.stringify(parsed.data.user));
          }
        } else {
          // Token invalid or expired
          logout();
        }
      } catch (err) {
        console.error('Session validation error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetchApi('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const parsed = await parseResponse(res);
      if (!parsed.ok || !parsed.data?.token) {
        return { success: false, error: parsed.error || 'Invalid email or password' };
      }

      setAuthToken(parsed.data.token);
      setTokenState(parsed.data.token);
      setUser(parsed.data.user);
      localStorage.setItem('vibeguard_user', JSON.stringify(parsed.data.user));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' };
    }
  };

  const register = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetchApi('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, name: name?.trim() })
      });

      const parsed = await parseResponse(res);
      if (!parsed.ok || !parsed.data?.token) {
        return { success: false, error: parsed.error || 'Registration failed' };
      }

      setAuthToken(parsed.data.token);
      setTokenState(parsed.data.token);
      setUser(parsed.data.user);
      localStorage.setItem('vibeguard_user', JSON.stringify(parsed.data.user));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' };
    }
  };


  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    try {
      localStorage.removeItem('vibeguard_user');
      localStorage.removeItem('vibeguard_selected_repo');
    } catch {}
    fetchApi('/api/auth/logout', { method: 'POST' }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
