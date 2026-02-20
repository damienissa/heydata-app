import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConversationProvider } from "@/context/ConversationContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "heydata",
  description: "AI-powered data analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConversationProvider>{children}</ConversationProvider>
      </body>
    </html>
  );
}
