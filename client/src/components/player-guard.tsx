import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";

interface PlayerGuardProps {
  children: ReactNode;
}

export default function PlayerGuard({ children }: PlayerGuardProps) {
  const { player, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !player) {
      const redirect = encodeURIComponent(location || "/");
      setLocation(`/login?redirect=${redirect}`);
    }
  }, [loading, player, location, setLocation]);

  if (loading) return null;
  if (!player) return null;
  return <>{children}</>;
}
