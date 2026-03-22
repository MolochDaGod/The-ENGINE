import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { checkAdminSession } from "@/lib/admin-auth";

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [location, setLocation] = useLocation();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      const isAuthorized = await checkAdminSession();
      if (cancelled) return;

      setAuthorized(isAuthorized);
      if (!isAuthorized) {
        const redirectTarget = encodeURIComponent(location || "/");
        setLocation(`/admin-login?redirect=${redirectTarget}`);
      }
    };

    verifySession();
    return () => {
      cancelled = true;
    };
  }, [location, setLocation]);
  if (authorized === null) return null;
  if (!authorized) return null;
  if (!authorized) return null;
  return <>{children}</>;
}
