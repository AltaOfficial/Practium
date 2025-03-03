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
          <MathjaxProvider>
            <Theme appearance="dark">{children}</Theme>
          </MathjaxProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
