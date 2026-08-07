"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "glass" | "elevated" | "interactive" | "bordered";
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "glass",
  onClick,
}) => {
  const baseStyles = "rounded-2xl transition-all duration-300 overflow-hidden";

  const variants = {
    glass:
      "bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 shadow-xl shadow-black/40",
    elevated:
      "bg-slate-900 border border-slate-800 shadow-2xl shadow-indigo-950/20",
    bordered: "bg-slate-950/60 border border-slate-800/90",
    interactive:
      "bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 shadow-xl hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer",
  };

  return (
    <div
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </div>
  );
};
