"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  roles: Array<"CLERK" | "MANAGER" | "ADMIN">;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/deliveries/record", label: "Record delivery", roles: ["CLERK", "ADMIN"] },
  { href: "/deliveries", label: "Deliveries", roles: ["CLERK", "MANAGER", "ADMIN"] },
  { href: "/verification", label: "Verification queue", roles: ["MANAGER", "ADMIN"] },
  { href: "/dashboard", label: "Centre dashboard", roles: ["MANAGER", "ADMIN"] },
  { href: "/farmers", label: "Farmers", roles: ["CLERK", "MANAGER", "ADMIN"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const visibleItems = user ? NAV_ITEMS.filter((item) => item.roles.includes(user.role)) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-primary-700 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-bold tracking-wide">Cooperative Deliveries</span>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden sm:inline text-primary-100">
                {user.name} · {user.role}
              </span>
              <button
                onClick={logout}
                className="min-h-[36px] rounded-md border border-white/40 px-3 py-1 font-medium hover:bg-white/10"
              >
                Log out
              </button>
            </div>
          )}
        </div>
        {user && (
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-1">
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-paper text-primary-700" : "text-primary-100 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
