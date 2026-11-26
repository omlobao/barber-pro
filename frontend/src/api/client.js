import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const TOKEN_STORAGE_KEY = 'barberpro_auth_v1';

export function getStoredTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens) {
  if (!tokens) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

api.interceptors.request.use((config) => {
  const tokens = getStoredTokens();
  if (tokens?.access && !config.url?.includes('/api/public/') && !config.url?.includes('/api/auth/login/')) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/login/') &&
      !originalRequest.url?.includes('/api/auth/refresh/')
    ) {
      const tokens = getStoredTokens();
      if (!tokens?.refresh) {
        setStoredTokens(null);
        window.dispatchEvent(new Event('barberpro:unauthorized'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newAccess) => {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh/`, {
          refresh: tokens.refresh,
        });
        const updated = {
          access: data.access,
          refresh: data.refresh || tokens.refresh,
        };
        setStoredTokens(updated);
        processQueue(null, updated.access);
        originalRequest.headers.Authorization = `Bearer ${updated.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setStoredTokens(null);
        window.dispatchEvent(new Event('barberpro:unauthorized'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
