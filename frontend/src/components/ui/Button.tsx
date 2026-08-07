"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary" | "ghost" | "danger" | "glowing" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-bold transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] max-w-full touch-manipulation";

  const variants = {
    primary:
      "bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 border border-indigo-400/30 rounded-xl",
    glowing:
      "bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 text-white shadow-[0_0_25px_rgba(99,102,241,0.5)] hover:shadow-[0_0_35px_rgba(99,102,241,0.7)] hover:scale-[1.02] border border-cyan-300/40 rounded-xl",
    secondary:
      "bg-slate-900/80 text-slate-100 hover:bg-slate-800 border border-slate-700/80 shadow-md backdrop-blur-md rounded-xl",
    ghost:
      "bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white rounded-lg",
    danger:
      "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 border border-rose-400/30 rounded-xl",
    outline:
      "bg-transparent text-indigo-400 border-2 border-indigo-500/60 hover:bg-indigo-500/10 hover:border-indigo-400 rounded-xl",
  };

  const sizes = {
    sm: "px-3 py-1.5 min-h-[36px] text-xs gap-1.5",
    md: "px-4 py-2.5 min-h-[44px] text-sm gap-2",
    lg: "px-6 py-3.5 min-h-[48px] text-base gap-2.5",
    xl: "px-8 py-4 min-h-[52px] text-lg gap-3 font-extrabold",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center justify-center gap-2 shrink-0">
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
          <span className="truncate">Processing...</span>
        </span>
      ) : (
        <span className="inline-flex items-center justify-center gap-2 max-w-full truncate">
          {leftIcon && (
            <span className="inline-flex items-center justify-center shrink-0">
              {leftIcon}
            </span>
          )}
          {children && (
            <span className="inline-flex items-center justify-center gap-1.5 truncate">
              {children}
            </span>
          )}
          {rightIcon && (
            <span className="inline-flex items-center justify-center shrink-0">
              {rightIcon}
            </span>
          )}
        </span>
      )}
    </button>
  );
};
