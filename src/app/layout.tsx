import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Capture — recordings you own", description: "Private local screen recording for teams." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
