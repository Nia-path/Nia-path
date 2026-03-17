// src/components/auth/AuthFormField.tsx
// Reusable form field components styled for the dark auth layout.

"use client";

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { cn } from "@/utils";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

// ─── AuthInput ────────────────────────────────────────────────────────────────

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, icon, className, id, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const isPassword = type === "password";
    const resolvedType = isPassword && showPassword ? "text" : type;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-earth-300 tracking-wide"
        >
          {label}
        </label>

        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-earth-500 pointer-events-none">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={cn(
              "w-full h-12 rounded-xl bg-white/[0.07] border transition-all duration-150",
              "text-white text-sm placeholder:text-earth-600",
              "focus:outline-none focus:ring-2 focus:ring-nia-400/60 focus:border-nia-400/60",
              icon ? "pl-10 pr-4" : "px-4",
              isPassword && "pr-12",
              error
                ? "border-emergency-500/60 focus:ring-emergency-400/50"
                : "border-white/10 hover:border-white/20",
              className
            )}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-earth-500 hover:text-earth-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-emergency-400 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);
AuthInput.displayName = "AuthInput";

// ─── AuthButton ───────────────────────────────────────────────────────────────

interface AuthButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "ghost";
}

export function AuthButton({
  loading = false,
  variant = "primary",
  disabled,
  className,
  children,
  ...props
}: AuthButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "w-full h-12 rounded-xl font-body font-semibold text-sm transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nia-400",
        "disabled:opacity-50 disabled:cursor-not-allowed select-none",
        "active:scale-[0.98] flex items-center justify-center gap-2",
        variant === "primary" &&
          "bg-nia-500 hover:bg-nia-400 text-white shadow-lg shadow-nia-900/40",
        variant === "ghost" &&
          "bg-transparent hover:bg-white/5 text-earth-400 hover:text-earth-200 border border-white/10 hover:border-white/20",
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>Please wait…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ─── AuthDivider ──────────────────────────────────────────────────────────────

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[11px] text-earth-600 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ─── AuthAlert ────────────────────────────────────────────────────────────────

interface AuthAlertProps {
  type: "error" | "success" | "info";
  message: string;
}

export function AuthAlert({ type, message }: AuthAlertProps) {
  const styles = {
    error: "bg-emergency-900/40 border-emergency-500/40 text-emergency-300",
    success: "bg-green-900/40 border-green-500/40 text-green-300",
    info: "bg-nia-900/40 border-nia-500/40 text-nia-300",
  };

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed animate-fade-in",
        styles[type]
      )}
      role={type === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
