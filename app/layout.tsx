import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Déclic — tes compétences cachées",
  description:
    "Un jeu de cartes pour révéler ce que tu sais faire, avec des preuves et des pistes concrètes.",
};

export const viewport: Viewport = {
  themeColor: "#F7F2E8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Les extensions navigateur (Grammarly, etc.) injectent des attributs
    // sur <html>/<body> avant l'hydratation. On ignore ces attributs.
    <html lang="fr" suppressHydrationWarning>
      <body
        className="min-h-dvh bg-paper text-ink antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
