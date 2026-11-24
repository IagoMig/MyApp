"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Utensils,
  Dumbbell,
  Scale,
  Camera,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Hoje", icon: Home, match: ["/"] },
  { href: "/diario", label: "Diário", icon: BookOpen, match: ["/diario"] },
  {
    href: "/alimentacao",
    label: "Dieta",
    icon: Utensils,
    match: ["/alimentacao"],
  },
  {
    href: "/treino",
    label: "Treino",
    icon: Dumbbell,
    match: ["/treino", "/corrida"],
  },
  { href: "/peso", label: "Peso", icon: Scale, match: ["/peso"] },
  { href: "/evolucao", label: "Fotos", icon: Camera, match: ["/evolucao"] },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed left-1/2 z-40 w-[calc(100%-24px)] max-w-[436px] -translate-x-1/2 safe-dock-bottom"
    >
      <div className="glass-dock flex items-center justify-between gap-0.5 rounded-[28px] px-1.5 py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
          const isActive = match.some((prefix) =>
            prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)
          );

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
              <Icon
                className="h-[18px] w-[18px]"
                strokeWidth={isActive ? 2.1 : 1.7}
              />
              <span className="text-[9.5px] font-medium tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
