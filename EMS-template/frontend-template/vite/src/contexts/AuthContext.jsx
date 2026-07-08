import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const API_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').trim().replace(/\/+$/, '');
const TOKEN_KEY = 'accounterp_access_token';

const defaultAuthValue = {
  token: null,
  user: null,
  loading: false,
  isAuthenticated: false,
  login: async () => {
    throw new Error('AuthProvider is missing');
  },
  logout: () => {}
};

const AuthContext = createContext(defaultAuthValue);

async function request(path, options = {}) {
  const cleanPath = String(path || '').trim().replace(/^\/+/, '/');
  const response = await fetch(`${API_URL}${cleanPath}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }

  return response.json();
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    request('/auth/me', { token })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email, password, keepSignedIn) {
    const result = await request('/auth/login', { method: 'POST', body: { email, password } });
    if (keepSignedIn) localStorage.setItem(TOKEN_KEY, result.accessToken);
    else sessionStorage.setItem(TOKEN_KEY, result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ token, user, loading, isAuthenticated: Boolean(user), login, logout }), [token, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context || defaultAuthValue;
}

AuthProvider.propTypes = { children: PropTypes.node };
