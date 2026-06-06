import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import { checkAdminSession } from "@/lib/admin-auth";

const ADMIN_ROLES = ['admin', 'master_admin'];

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [location, setLocation] = useLocation();
  const { player, loading } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [legacyAuthed, setLegacyAuthed] = useState<boolean | null>(null);

  // Fast path: player already loaded with admin role
  const playerIsAdmin = player?.role ? ADMIN_ROLES.includes(player.role) : false;

  useEffect(() => {
    if (loading) return;
    if (playerIsAdmin) return; // already authorized

    // Check legacy admin cookie as fallback
    let cancelled = false;
    (async () => {
      const legacy = await checkAdminSession();
      if (cancelled) return;
      setLegacyAuthed(legacy);
      if (!legacy) {
        // Not admin via any method — prompt login
        if (!player) {
          openAuthModal({ reason: 'Admin access requires login' });
        } else {
          // Logged in but not admin — redirect to home
          setLocation('/');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loading, playerIsAdmin, player, setLocation, openAuthModal]);

  if (loading) return null;
  if (playerIsAdmin) return <>{children}</>;
  if (legacyAuthed) return <>{children}</>;
  return null;
}
