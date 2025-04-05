import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";
import "@radix-ui/themes/styles.css";
import MathjaxProvider from "@/contexts/MathjaxContext";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "HuhAI",
  description: "Learn More, Study Less",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ThemeProvider>
            <MathjaxProvider>
              <Theme>{children}</Theme>
            </MathjaxProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
