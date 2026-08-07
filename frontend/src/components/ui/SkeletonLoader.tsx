"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "avatar" | "button";
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  className = "",
  variant = "text",
}) => {
  const baseStyles = "animate-pulse bg-slate-800/80 rounded-xl";

  const variants = {
    text: "h-4 w-full",
    card: "h-40 w-full",
    avatar: "h-12 w-12 rounded-full",
    button: "h-10 w-28",
  };

  return <div className={`${baseStyles} ${variants[variant]} ${className}`} />;
};
