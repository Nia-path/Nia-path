// src/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  fullWidth?: boolean;
}

const variants = {
  primary:
    "bg-nia-600 hover:bg-nia-700 active:bg-nia-800 text-white shadow-sm disabled:bg-nia-300",
  secondary:
    "bg-earth-100 hover:bg-earth-200 active:bg-earth-300 text-earth-800",
  danger:
    "bg-emergency-600 hover:bg-emergency-700 active:bg-emergency-700 text-white shadow-emergency",
  ghost:
    "bg-transparent hover:bg-earth-100 active:bg-earth-200 text-earth-700",
  outline:
    "border border-nia-300 hover:border-nia-400 hover:bg-nia-50 text-nia-700 bg-transparent",
};

const sizes = {
  sm:  "h-8  px-3  text-sm  rounded-lg  gap-1.5",
  md:  "h-10 px-4  text-sm  rounded-xl  gap-2",
  lg:  "h-12 px-6  text-base rounded-xl  gap-2",
  xl:  "h-14 px-8  text-lg  rounded-2xl gap-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-body font-medium",
        "transition-all duration-150 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-nia-400 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed select-none",
        "active:scale-[0.98]",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
);

Button.displayName = "Button";
