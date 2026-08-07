"use client";

import React from "react";
import { Layers, Users, Search, BarChart3, HelpCircle } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  type?: "quizzes" | "players" | "search" | "analytics" | "default";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = "default",
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const icons = {
    quizzes: <Layers className="w-12 h-12 text-indigo-400" />,
    players: <Users className="w-12 h-12 text-cyan-400" />,
    search: <Search className="w-12 h-12 text-amber-400" />,
    analytics: <BarChart3 className="w-12 h-12 text-emerald-400" />,
    default: <HelpCircle className="w-12 h-12 text-slate-400" />,
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/60 border border-slate-800/80 rounded-2xl backdrop-blur-xl">
      <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 mb-4 shadow-lg">
        {icons[type]}
      </div>
      <h3 className="text-xl font-extrabold text-slate-100">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mt-1.5 mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
