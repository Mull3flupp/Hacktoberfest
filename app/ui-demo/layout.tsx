import type { ReactNode } from "react";
import { fontClasses } from "../../components/ui/fonts";
import "../../components/ui/theme.css";

export const metadata = { title: "UI-Demo – Wenn ich König von Deutschland wär" };

export default function UiDemoLayout({ children }: { children: ReactNode }) {
  return <div className={`${fontClasses} min-h-dvh`}>{children}</div>;
}
