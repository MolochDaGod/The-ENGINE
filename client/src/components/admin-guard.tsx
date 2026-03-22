import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

const ADMIN_AUTH_KEY = "grudge_admin_authenticated";

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [location, setLocation] = useLocation();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const isAuthorized = localStorage.getItem(ADMIN_AUTH_KEY) === "true";
    setAuthorized(isAuthorized);

    if (!isAuthorized) {
      const redirectTarget = encodeURIComponent(location || "/");
      setLocation(`/admin-login?redirect=${redirectTarget}`);
    }
  }, [location, setLocation]);

  if (!authorized) return null;
  return <>{children}</>;
}
