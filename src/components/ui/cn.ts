import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Varianten und individuelle Tailwind-Klassen ohne widersprüchliche Utilities. */
export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}
