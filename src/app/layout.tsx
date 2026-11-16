import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "WAGNOVATE CEO DESK", template: "%s · WAGNOVATE CEO DESK" },
  description: "Lead Better. Measure Progress. Build Bigger.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "CEO Desk", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#050a16", width: "device-width", initialScale: 1 };

// "system" is resolved before first paint by this inline script, so there is no light/dark flash.
const SYSTEM_SCRIPT = `try{var t=document.cookie.match(/ceo-theme=(\\w+)/);if(t&&t[1]==='system'){document.documentElement.className=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("ceo-theme")?.value ?? "dark";
  return (
    <html lang="en" className={theme === "light" ? "light" : "dark"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
