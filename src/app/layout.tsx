import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../index.css";
import { Providers } from "./providers";

// TODO: Replace with Instrument Sans when font files are added to /public/fonts/
// To use Instrument Sans, download the font files and use:
// import localFont from "next/font/local";
// const instrumentSans = localFont({
//   src: [
//     { path: "../../public/fonts/InstrumentSans-Regular.woff2", weight: "400" },
//     { path: "../../public/fonts/InstrumentSans-Medium.woff2", weight: "500" },
//     { path: "../../public/fonts/InstrumentSans-SemiBold.woff2", weight: "600" },
//     { path: "../../public/fonts/InstrumentSans-Bold.woff2", weight: "700" },
//   ],
//   variable: "--font-instrument-sans",
//   display: "swap",
// });

// Temporary: Using Inter as placeholder until Instrument Sans files are added
const instrumentSans = Inter({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "aussie-ops-hub",
  description: "We Will Australia Operations Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={instrumentSans.variable}>
      <body className={instrumentSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

