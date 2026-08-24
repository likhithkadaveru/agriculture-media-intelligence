import type { Metadata } from "next";
import { Fraunces, Inter, Noto_Sans_Telugu, Noto_Serif_Telugu } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  variable: "--font-telugu",
  weight: ["400", "500", "600"],
});

const notoSerifTelugu = Noto_Serif_Telugu({
  subsets: ["telugu"],
  variable: "--font-telugu-serif",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Telangana Agriculture Intelligence",
  description:
    "Public-intelligence command centre for the Telangana agriculture ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${notoSansTelugu.variable} ${notoSerifTelugu.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
