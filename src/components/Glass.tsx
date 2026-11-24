"use client";

import React from "react";

export function AmbientBackdrop() {
  return (
    <div className="obsidian-canvas" aria-hidden="true">
      <div className="obsidian-orb obsidian-orb-1" />
      <div className="obsidian-orb obsidian-orb-2" />
      <div className="obsidian-orb obsidian-orb-3" />
      <div className="obsidian-grid" />
    </div>
  );
}

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "frosted" | "obsidian" | "lined";
}

export function GlassCard({
  variant = "default",
  className = "",
  children,
  ...props
}: GlassCardProps) {
  const variantClass =
    variant === "frosted"
      ? "glass-frosted"
      : variant === "obsidian"
        ? "glass-obsidian"
        : variant === "lined"
          ? "glass-lined"
          : "glass-surface";

  return (
    <div
      className={`${variantClass} rounded-[28px] transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function GlassButton({
  active = false,
  className = "",
  children,
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={`${
        active ? "glass-pill-active" : "glass-pill text-white"
      } inline-flex items-center justify-center gap-2 rounded-2xl transition-all duration-150 active:scale-[0.96] disabled:opacity-40 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
