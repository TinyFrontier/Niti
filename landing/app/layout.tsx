import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f7fb",
};

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "useniti.xyz";
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Niti — Don’t lose the thread",
    description:
      "A career workspace that connects every move — from job link to clear decision to offer.",
    icons: {
      icon: "/brand/niti-app-icon.svg",
      shortcut: "/brand/niti-app-icon.svg",
      apple: "/brand/niti-app-icon.svg",
    },
    openGraph: {
      type: "website",
      url: origin,
      siteName: "Niti",
      title: "Niti — Don’t lose the thread",
      description:
        "Paste a job link, inspect the fit, and keep every next move connected.",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "Niti — Don’t lose the thread",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Niti — Don’t lose the thread",
      description:
        "A career workspace that keeps every move connected.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
