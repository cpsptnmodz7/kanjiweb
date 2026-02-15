import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Kanji Laopu",
  description: "Belajar kanji dengan quiz, review, dan progress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AppShell backgroundImage="/anime-wallpaper.jpg">{children}</AppShell>
      </body>
    </html>
  );
}
