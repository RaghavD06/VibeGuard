export const API_BASE_URL = (() => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl === '/' ? '' : envUrl.replace(/\/$/, '');

  // Production deployments proxy API routes through the current HTTPS origin.
  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return '';
  }

  return 'http://localhost:3001';
})();



export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('vibeguard_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('vibeguard_token', token);
    } else {
      localStorage.removeItem('vibeguard_token');
    }
  } catch {}
}

export async function fetchApi(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) {
    setAuthToken(null);
    try {
      localStorage.removeItem('vibeguard_user');
    } catch {}
    if (
      typeof window !== 'undefined' && 
      !window.location.pathname.startsWith('/login') && 
      !window.location.pathname.startsWith('/register') && 
      window.location.pathname !== '/'
    ) {
      window.location.href = '/login';
    }
  }

  return response;
}
