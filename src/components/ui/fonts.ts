import { Nunito, Pixelify_Sans } from "next/font/google";

// Pixel-Schrift nur für Überschriften und Zahlen, Fließtext in Nunito.
// Das latin-Subset enthält Ä Ö Ü ä ö ü ß.
export const pixelFont = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

export const bodyFont = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/** Auf ein Wurzel-Element setzen, z. B. <body className={fontClasses}>. */
export const fontClasses = `${pixelFont.variable} ${bodyFont.variable} px-root`;
