import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Sell Up - Create Your Online Store in Minutes",
  description:
    "Create your online store in minutes. Receive every order directly on WhatsApp. No coding required.",
  icons: {
    icon: "/assets/fav.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} bg-white text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
