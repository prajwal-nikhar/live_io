export const getBackendUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window === 'undefined') return 'http://localhost:4000';
  const origin = window.location.origin;
  if (origin.includes('.e2b.app')) {
    return origin.replace('3000-', '4000-');
  }
  return 'http://localhost:4000';
};

export const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  return getBackendUrl();
};

// Extract E2B Traffic Access Token if passed in URL or cookies
export const getE2BTrafficAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  // 1. Try URL parameters first
  const params = new URLSearchParams(window.location.search);
  const tokenKeys = [
    'e2b-traffic-access-token',
    'e2b_traffic_access_token',
    'traffic_access_token',
    'token',
    '_token'
  ];

  for (const key of tokenKeys) {
    const val = params.get(key);
    if (val) {
      localStorage.setItem('e2b_traffic_access_token', val);
      return val;
    }
  }

  // 2. Try localStorage cache
  const cached = localStorage.getItem('e2b_traffic_access_token');
  if (cached) return cached;

  // 3. Try parsing cookies
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'e2b-traffic-access-token' || name === 'e2b_traffic_access_token') {
        localStorage.setItem('e2b_traffic_access_token', value);
        return value;
      }
    }
  } catch (e) {}

  return null;
};

export const apiRequest = async (path: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const baseUrl = getBackendUrl();
  const e2bToken = getE2BTrafficAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(e2bToken ? { 'e2b-traffic-access-token': e2bToken } : {}), // Bypasses E2B Sandbox proxy locks!
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || 'API request failed');
  }

  return response.json();
};
