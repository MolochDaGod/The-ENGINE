import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { fetchMe, logoutPlayer, type PlayerProfile } from "@/lib/player-auth";
import { clearPlayerCache } from "@/lib/engine-sdk";

interface AuthContextValue {
  player: PlayerProfile | null;
  loading: boolean;
  /** Call after successful login/register to refresh the session */
  refresh: () => Promise<void>;
  /** Call to log out and clear state */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  player: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    clearPlayerCache();
    const p = await fetchMe();
    setPlayer(p);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await logoutPlayer();
    clearPlayerCache();
    setPlayer(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ player, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
