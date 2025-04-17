"use client";
import Link from "next/link";
import { Button } from "@radix-ui/themes";
import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#F2F2F2] text-default font-poppins">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto py-6">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/practium-logo.svg"
              alt="Practium Logo"
              width={40}
              height={40}
              priority
            />
            <span className="text-2xl text-black font-bold">Practium</span>
          </Link>

          <div className="flex items-center gap-10 justify-between">
            <Link
              href="#"
              className="text-default font-medium hover:text-black"
            >
              Explore
            </Link>
            <Link
              href="#"
              className="text-default font-medium hover:text-black selected-nav-item"
            >
              Features
            </Link>
            <Link
              href="#"
              className="text-default font-medium hover:text-black"
            >
              Pricing
            </Link>
            <Link
              href="#"
              className="text-default font-medium hover:text-black"
            >
              FAQ
            </Link>
          </div>

          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-default font-medium hover:text-black"
            >
              Login
            </Link>
            <Button
              onClick={() => router.push("/dashboard")}
              className="!bg-[#333333] text-white px-4 py-2 rounded-lg hover:opacity-80 hover:cursor-pointer"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 pt-20 pb-24 text-center">
        <h1 className="text-6xl font-medium text-default mb-6">
          Learn more, study less.
        </h1>
        <p className="text-xl text-[#878787] font-medium max-w-2xl mx-auto mb-12">
          Turn notes into practice questions and flashcards, helping you learn
          faster with smart repetition and instant feedback.
        </p>
        <Button
          radius="full"
          onClick={() => router.push("/dashboard")}
          className="!bg-[#333333] text-white px-8 py-4 font-medium rounded-3xl text-lg hover:bg-gray-800 hover:cursor-pointer"
        >
          Get Started
          <FiArrowRight size={20} />
        </Button>

        {/* Video/Demo Section */}
        <div className="mt-16 rounded-2xl overflow-hidden bg-white aspect-video max-w-4xl mx-auto shadow-[5px_5px_0_0px_rgba(51,51,51,1)]">
          {/* Replace this div with an actual video or demo component */}
          <div className="w-full h-full bg-[#D9D9D9]"></div>
        </div>
      </main>
    </div>
  );
}
