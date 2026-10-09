import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareCopilot AI — Your health, in context",
  description: "A personal health information copilot and care dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
