"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Utensils, Footprints, Camera } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Hoje", icon: Home },
  { href: "/diario", label: "Diário", icon: BookOpen },
  { href: "/alimentacao", label: "Refeições", icon: Utensils },
  { href: "/corrida", label: "Corrida", icon: Footprints },
  { href: "/evolucao", label: "Evolução", icon: Camera },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed left-1/2 z-40 w-[calc(100%-28px)] max-w-[432px] -translate-x-1/2 safe-dock-bottom"
    >
      <div className="glass-dock flex items-center justify-between rounded-[28px] px-2 py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] py-2 transition-all duration-200 ${
                isActive
                  ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.1 : 1.7} />
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
