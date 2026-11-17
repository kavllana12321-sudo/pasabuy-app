import type { Metadata } from "next";
import { AppProvider } from "@/components/AppProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PasaBuy PH — Your everyday errands, sorted",
  description: "Book local shopping, pickup and delivery, rides, and connect with your community marketplace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full"><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
