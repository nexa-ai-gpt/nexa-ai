"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AppNavProps {
  userEmail?: string | null;
}

export function AppNav({ userEmail }: AppNavProps) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Chat" },
    { href: "/notes", label: "Notes" },
    { href: "/library", label: "Library" },
  ];

  return (
    <nav className="flex items-center justify-between border-b border-white/10 bg-black/60 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-bold tracking-tight text-white">
          Manus AI
        </Link>
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
      {userEmail && (
        <span className="text-xs text-zinc-500">{userEmail}</span>
      )}
    </nav>
  );
}
