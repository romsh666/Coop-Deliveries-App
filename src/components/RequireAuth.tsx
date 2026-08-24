"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { LoadingState } from "./States";
import type { Role } from "@/types";


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
    
  }, [loading, user]);

  if (loading || !user || (allow && !allow.includes(user.role))) {
    return <LoadingState />;
  }

  return <>{children}</>;
}
