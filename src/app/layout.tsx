import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wenn ich König von Deutschland wäre",
  description: "Gründe ein fiktives Land, entscheide über seine Institutionen und erlebe die Folgen. Ein Prototyp für politische Bildung.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
