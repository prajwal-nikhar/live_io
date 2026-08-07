"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = "",
  id,
  ...props
}) => {
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`w-full bg-slate-950/80 border text-slate-100 placeholder-slate-500 text-sm font-medium rounded-xl py-3 ${
            icon ? "pl-10 font-semibold" : "px-4"
          } pr-4 transition-all focus:outline-none focus:ring-2 ${
            error
              ? "border-rose-500 focus:ring-rose-500/50"
              : "border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30"
          } ${className}`}
          {...props}
        />
      </div>

      {error && (
        <p className="text-xs text-rose-400 font-medium animate-fadeIn">
          {error}
        </p>
      )}
    </div>
  );
};
