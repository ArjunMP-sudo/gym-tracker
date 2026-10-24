import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "ASCEND — The Training System", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#08080d" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
