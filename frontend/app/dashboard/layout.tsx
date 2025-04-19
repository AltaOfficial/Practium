"use client";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();

  return (
    <div className="min-h-screen bg-[#F2F2F2] font-poppins">
      {!pathname.match(
        /^\/dashboard\/practice\/courses\/\d+\/assessments\/\d+$/
      ) ? (
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
      ) : (
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

            <Link
              href={`/dashboard/practice/courses/${params.course_id}`}
              className="!bg-[#333333] text-white text-sm px-5 py-2 rounded-md font-medium hover:opacity-90"
            >
              Exit
            </Link>
          </div>
        </nav>
      )}
      {!pathname.match(
        /^\/dashboard\/practice\/courses\/\d+\/assessments\/\d+$/
      ) ? (
        <main className="max-w-7xl mx-auto px-12">{children}</main>
      ) : (
        <main className="max-w-7xl mx-auto">{children}</main>
      )}
    </div>
  );
}
