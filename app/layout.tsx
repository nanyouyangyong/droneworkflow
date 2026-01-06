import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Drone Workflow",
  description: "Drone intelligent workflow system"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
