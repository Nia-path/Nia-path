// src/components/ui/Card.tsx
import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

const paddings = { sm: "p-3", md: "p-4", lg: "p-6" };

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover = false, padding = "md", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-2xl shadow-nia-card border border-earth-100",
        hover && "transition-shadow duration-200 hover:shadow-nia-card-hover cursor-pointer",
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";

// ─── Badge ──────────────────────────────────────────────────────────────────

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

const badgeVariants = {
  default: "bg-earth-100 text-earth-700",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger:  "bg-emergency-100 text-emergency-700",
  info:    "bg-blue-100 text-blue-800",
};

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ─── Input ──────────────────────────────────────────────────────────────────

import { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-earth-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full px-4 rounded-xl border bg-white text-earth-900 text-sm",
          "placeholder:text-earth-400 transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-nia-400 focus:border-nia-400",
          error
            ? "border-emergency-500 focus:ring-emergency-300"
            : "border-earth-200 hover:border-earth-300",
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-earth-500">{hint}</p>}
      {error && <p className="text-xs text-emergency-600">{error}</p>}
    </div>
  );
}

// ─── Textarea ───────────────────────────────────────────────────────────────

import { type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-earth-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "w-full px-4 py-3 rounded-xl border bg-white text-earth-900 text-sm",
          "placeholder:text-earth-400 transition-colors duration-150 resize-none",
          "focus:outline-none focus:ring-2 focus:ring-nia-400 focus:border-nia-400",
          error
            ? "border-emergency-500"
            : "border-earth-200 hover:border-earth-300",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-emergency-600">{error}</p>}
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-earth-100",
        className
      )}
      {...props}
    />
  );
}

// ─── Divider ────────────────────────────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-earth-100" />
      {label && <span className="text-xs text-earth-400 shrink-0">{label}</span>}
      <div className="flex-1 h-px bg-earth-100" />
    </div>
  );
}
