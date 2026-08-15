import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "swage — ASL fingerspelling handshape practice",
    short_name: "swage",
    description:
      "Real-time ASL fingerspelling handshape practice, graded by a classifier trained and evaluated as part of this project.",
    start_url: "/practice",
    display: "standalone",
    background_color: "#FAF7F2", // PAPER
    theme_color: "#FAF7F2", // PAPER
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
