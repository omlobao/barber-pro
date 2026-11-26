import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const clientApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const CLIENT_TOKEN_STORAGE_KEY = 'barberpro_client_auth_v1';

export function getStoredClientTokens() {
  try {
    const raw = localStorage.getItem(CLIENT_TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredClientTokens(tokens) {
  if (!tokens) {
    localStorage.removeItem(CLIENT_TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(CLIENT_TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

clientApi.interceptors.request.use((config) => {
  const tokens = getStoredClientTokens();
  const isAuthEndpoint =
    config.url?.includes('/api/client/login/') ||
    config.url?.includes('/api/client/register/') ||
    config.url?.includes('/api/auth/refresh/');

  if (tokens?.access && !isAuthEndpoint) {
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

clientApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/client/login/') &&
      !originalRequest.url?.includes('/api/client/register/') &&
      !originalRequest.url?.includes('/api/auth/refresh/')
    ) {
      const tokens = getStoredClientTokens();
      if (!tokens?.refresh) {
        setStoredClientTokens(null);
        window.dispatchEvent(new Event('barberpro:client-unauthorized'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newAccess) => {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return clientApi(originalRequest);
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
        setStoredClientTokens(updated);
        processQueue(null, updated.access);
        originalRequest.headers.Authorization = `Bearer ${updated.access}`;
        return clientApi(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setStoredClientTokens(null);
        window.dispatchEvent(new Event('barberpro:client-unauthorized'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default clientApi;
