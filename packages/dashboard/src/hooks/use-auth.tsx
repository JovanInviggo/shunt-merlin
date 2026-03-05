import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin as apiAdminLogin, revokeRefreshToken, storeTokens, clearTokens, getStoredTokens } from "@/lib/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() =>
    getStoredTokens().accessToken,
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiAdminLogin(email, password);
      storeTokens(res.accessToken, res.refreshToken);
      setToken(res.accessToken);
      navigate("/", { replace: true });
    },
    [navigate],
  );

  const logout = useCallback(() => {
    const { refreshToken } = getStoredTokens();
    if (refreshToken) {
      revokeRefreshToken(refreshToken).catch(() => {});
    }
    clearTokens();
    setToken(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({ isAuthenticated: !!token, login, logout }),
    [token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
