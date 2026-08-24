"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { LoadingState } from "@/components/States";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "CLERK") {
      router.replace("/deliveries/record");
    } else {
      router.replace("/verification");
    }
    
  }, [loading, user]);

  return <LoadingState />;
}
