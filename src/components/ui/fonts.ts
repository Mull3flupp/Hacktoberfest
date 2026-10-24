import localFont from "next/font/local";

// Pixel-Schrift nur für Überschriften und Zahlen, Fließtext in Nunito.
// Das latin-Subset enthält Ä Ö Ü ä ö ü ß.
export const pixelFont = localFont({
  src: "./assets/fonts/PixelifySans-Variable.ttf",
  weight: "400 700",
  variable: "--font-pixel",
  display: "swap",
});

export const bodyFont = localFont({
  src: "./assets/fonts/Nunito-Variable.ttf",
  weight: "200 1000",
  variable: "--font-body",
  display: "swap",
});

/** Auf ein Wurzel-Element setzen, z. B. <body className={fontClasses}>. */
export const fontClasses = `${pixelFont.variable} ${bodyFont.variable} px-root`;
