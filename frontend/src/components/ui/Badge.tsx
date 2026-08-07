"use client";

import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "live" | "success" | "warning" | "error" | "info" | "neutral";
  className?: string;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "info",
  className = "",
  pulse = false,
}) => {
  const baseStyles =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide select-none border";

  const variants = {
    live: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    error: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    info: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    neutral: "bg-slate-800/80 text-slate-300 border-slate-700/60",
  };

  const dotColors = {
    live: "bg-rose-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-rose-500",
    info: "bg-indigo-500",
    neutral: "bg-slate-400",
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[variant]}`}
          />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
};
