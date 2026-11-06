import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { studentApi, type Me } from './api';

interface SessionValue {
  /** undefined = đang kiểm tra, null = chưa đăng nhập */
  me: Me | null | undefined;
  setMe: (me: Me | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    studentApi
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const logout = useCallback(async () => {
    try {
      await studentApi.logout();
    } finally {
      setMe(null);
    }
  }, []);

  return <Ctx.Provider value={{ me, setMe, logout }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession phải nằm trong SessionProvider');
  return v;
}
