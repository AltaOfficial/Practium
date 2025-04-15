import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F2F2F2] font-poppins">
      <nav className="max-w-7xl mx-auto py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image
              src="/practium-logo.svg"
              alt="Practium Logo"
              width={40}
              height={40}
              priority
            />
            <span className="text-2xl text-black font-bold">Practium</span>
          </div>

          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4">
        {children}
      </main>
    </div>
  );
} 