"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "default" | "secondary" | "destructive" | "ghost" | "outline";
type ButtonSize = "default" | "sm" | "xs" | "icon";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "btn-primary",
  secondary: "btn-secondary",
  destructive: "btn-primary bg-red-600 hover:bg-red-700 focus:bg-red-700",
  outline: "btn-secondary",
  ghost:
    "border border-transparent bg-transparent text-text-muted hover:text-text hover:bg-bg-subtle",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  default: "text-sm",
  sm: "text-sm",
  xs: "text-xs",
  icon: "p-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "default",
  size = "default",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    size === "icon" ? "inline-flex items-center justify-center" : "inline-flex items-center gap-2",
    "disabled:opacity-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}