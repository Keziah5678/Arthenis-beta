import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Arthenis — Where worlds are born", description: "AI collaborative world-building platform" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fr"><body>{children}</body></html>; }