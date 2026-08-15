import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "swage — ASL fingerspelling handshape practice",
    template: "%s · swage",
  },
  description:
    "Real-time ASL fingerspelling handshape practice, graded by a classifier trained and evaluated as part of this project. Runs entirely on your device.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
