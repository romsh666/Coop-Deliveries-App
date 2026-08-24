"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { LoadingState } from "./States";
import type { Role } from "@/types";

/**
 * Client-side gate: redirects to /login if there's no session, and to a
 * safe default page if the logged-in user's role isn't in `allow`. This is
 * a UX convenience only — every API route independently re-checks role and
 * ownership server-side (see requireRole/requireOwnCentre), so this guard
 * hiding a link or redirecting away is never the actual security boundary.
 */
export function RequireAuth({
  allow,
  children,
}: {
  allow?: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (allow && !allow.includes(user.role)) {
      router.replace("/deliveries");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  if (loading || !user || (allow && !allow.includes(user.role))) {
    return <LoadingState />;
  }

  return <>{children}</>;
}
