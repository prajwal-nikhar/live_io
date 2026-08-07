"use client";

import React from "react";
import { AlertCircle, WifiOff, Lock, HelpCircle } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  type?: "network" | "unauthorized" | "notfound" | "general";
  title: string;
  message: string;
  onRetry?: () => void;
  onHome?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = "general",
  title,
  message,
  onRetry,
  onHome,
}) => {
  const icons = {
    network: <WifiOff className="w-12 h-12 text-rose-400 animate-bounce" />,
    unauthorized: <Lock className="w-12 h-12 text-amber-400" />,
    notfound: <HelpCircle className="w-12 h-12 text-cyan-400" />,
    general: <AlertCircle className="w-12 h-12 text-rose-400" />,
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-2xl max-w-md mx-auto">
      <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 mb-4">
        {icons[type]}
      </div>
      <h2 className="text-2xl font-black text-slate-100">{title}</h2>
      <p className="text-sm text-slate-400 mt-2 mb-6 leading-relaxed">
        {message}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try Again
          </Button>
        )}
        {onHome && (
          <Button variant="secondary" onClick={onHome}>
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
};
