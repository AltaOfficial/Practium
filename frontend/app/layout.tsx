import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "@radix-ui/themes/styles.css";
import MathjaxProvider from "@/contexts/MathjaxContext";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Poppins } from "next/font/google";

// Import KaTeX CSS
import "katex/dist/katex.min.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Practium",
  description: "Learn More, Study Less",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${poppins.variable}`}>
      <body>
        <ClerkProvider>
          <ThemeProvider>
            <MathjaxProvider>
              <Theme accentColor="gray">{children}</Theme>
            </MathjaxProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
