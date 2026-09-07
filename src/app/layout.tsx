import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

// The real production alias, verified over HTTP on 2026-09-07.
// swage.vercel.app is a DIFFERENT, unrelated site owned by someone else —
// pointing metadataBase or a canonical at it hands this project's OG image
// and canonical signal to a stranger.
const SITE_URL = "https://swage-swart.vercel.app";
const SITE_TITLE = "swage — ASL fingerspelling handshape practice";
const SITE_DESCRIPTION =
  "Real-time ASL fingerspelling handshape practice, graded by a classifier trained and evaluated as part of this project. Runs entirely on your device.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · swage" },
  description: SITE_DESCRIPTION,
  icons: {
    // swage's own glyph is the identity in a tab (BRAND-KIT.md's icon
    // hierarchy) — the chip stays the maker's mark, used in the footer
    // and README lockup instead.
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/brand/favicon.svg",
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/brand/icon-maskable.svg", color: "#B45309" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "swage",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "swage — Agent James" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/brand/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
