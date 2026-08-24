import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-100 disabled:text-primary-400",
  secondary: "bg-white text-primary-700 border border-primary-600 hover:bg-primary-50 disabled:opacity-50",
  danger: "bg-status-rejected text-white hover:opacity-90 disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-line disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
