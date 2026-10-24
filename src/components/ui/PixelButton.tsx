import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";

export type PixelButtonVariant = "primary" | "secondary" | "danger" | "info" | "tutor";
export type PixelButtonSize = "sm" | "md" | "lg";

const variants: Record<PixelButtonVariant, string> = {
  primary: "bg-[var(--px-green)] text-white shadow-[0_var(--px-shadow)_0_var(--px-green-dark)]",
  secondary: "bg-[var(--px-white)] text-[var(--px-ink)] shadow-[0_var(--px-shadow)_0_var(--px-gray-dark)]",
  danger: "bg-[var(--px-red)] text-white shadow-[0_var(--px-shadow)_0_var(--px-red-dark)]",
  info: "bg-[var(--px-blue)] text-white shadow-[0_var(--px-shadow)_0_var(--px-blue-dark)]",
  tutor: "bg-[var(--px-purple)] text-white shadow-[0_var(--px-shadow)_0_var(--px-purple-dark)]",
};

const sizes: Record<PixelButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-5 text-lg",
};

export type PixelButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: PixelButtonVariant;
  size?: PixelButtonSize;
  fullWidth?: boolean;
};

/** Dicker Pixel-Button mit hartem Unterschatten, sinkt beim Drücken ein. */
export function PixelButton({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  type = "button",
  ...props
}: PixelButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "font-pixel inline-flex select-none items-center justify-center gap-2 uppercase",
        "border-[length:var(--px-border)] border-[var(--px-ink)]",
        "mb-[var(--px-shadow)] transition-none",
        "active:translate-y-[var(--px-shadow)] active:shadow-none",
        "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--px-yellow)]",
        "disabled:cursor-not-allowed disabled:bg-[var(--px-gray)] disabled:text-[var(--px-gray-dark)]",
        "disabled:shadow-[0_var(--px-shadow)_0_var(--px-gray-dark)] disabled:active:translate-y-0",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
