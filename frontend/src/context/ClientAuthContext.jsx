import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import clientApi, {
  getStoredClientTokens,
  setStoredClientTokens,
} from '@/api/clientApi';

const ClientAuthContext = createContext(null);

export function ClientAuthProvider({ children }) {
  const [client, setClient] = useState(null);
  const [loadingClient, setLoadingClient] = useState(() =>
    Boolean(getStoredClientTokens()?.access)
  );

  const fetchClientMe = useCallback(async () => {
    const tokens = getStoredClientTokens();
    if (!tokens?.access) {
      setClient(null);
      setLoadingClient(false);
      return null;
    }
    try {
      const { data } = await clientApi.get('/api/client/me/');
      setClient(data);
      return data;
    } catch {
      setStoredClientTokens(null);
      setClient(null);
      return null;
    } finally {
      setLoadingClient(false);
    }
  }, []);

  useEffect(() => {
    fetchClientMe();
  }, [fetchClientMe]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setClient(null);
    };
    window.addEventListener(
      'barberpro:client-unauthorized',
      handleUnauthorized
    );
    return () =>
      window.removeEventListener(
        'barberpro:client-unauthorized',
        handleUnauthorized
      );
  }, []);

  const loginClient = useCallback(async (identifier, password) => {
    const { data } = await clientApi.post('/api/client/login/', {
      identifier,
      password,
    });
    if (data.account_type === 'STAFF') {
      return {
        accountType: 'STAFF',
        tokens: { access: data.access, refresh: data.refresh },
        user: data.user,
      };
    }
    setStoredClientTokens({ access: data.access, refresh: data.refresh });
    setClient(data.client);
    return {
      accountType: 'CLIENT',
      client: data.client,
    };
  }, []);

  const registerClient = useCallback(async (payload) => {
    const { data } = await clientApi.post('/api/client/register/', payload);
    setStoredClientTokens({ access: data.access, refresh: data.refresh });
    setClient(data.client);
    return data.client;
  }, []);

  const updateClientProfile = useCallback(async (payload) => {
    const { data } = await clientApi.patch('/api/client/me/', payload);
    setClient(data);
    return data;
  }, []);

  const logoutClient = useCallback(() => {
    setStoredClientTokens(null);
    setClient(null);
  }, []);

  return (
    <ClientAuthContext.Provider
      value={{
        client,
        loadingClient,
        isClientAuthenticated: Boolean(client),
        loginClient,
        registerClient,
        updateClientProfile,
        logoutClient,
        refreshClient: fetchClientMe,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) {
    throw new Error(
      'useClientAuth deve ser utilizado dentro de um ClientAuthProvider'
    );
  }
  return ctx;
}
