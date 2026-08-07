"use client";

import React from "react";

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: "indigo" | "emerald" | "amber" | "rose" | "gradient";
  height?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = "indigo",
  height = "md",
  animated = true,
  className = "",
}) => {
  const heights = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const colors = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    gradient: "bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400",
  };

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={`w-full bg-slate-800/80 rounded-full overflow-hidden ${heights[height]} ${className}`}
    >
      <div
        className={`${colors[color]} h-full rounded-full ${
          animated ? "transition-all duration-300 ease-out" : ""
        }`}
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
};
