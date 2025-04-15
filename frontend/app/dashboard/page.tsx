"use client";
import Link from "next/link";
import { LuBrain } from "react-icons/lu";
import { TbCards } from "react-icons/tb";


export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto py-16">
      <h1 className="text-4xl text-default font-medium text-center mb-16">
        Choose your Study Method
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Flashcards Card */}
        <Link href="/dashboard/memory" className="group">
          <div className="bg-white p-8 rounded-xl flex flex-col items-center text-center transition-transform hover:-translate-y-1 shadow-[5px_5px_0_0px_rgba(51,51,51,1)]">
            <div className="mb-3">
              <TbCards size={80} strokeWidth={1.5} className="text-[#333333]" />
            </div>
            <h2 className="text-4xl text-nowrap mb-4 font-semibold text-default">AI Flashcards</h2>
            <p className="text-[#878787] mb-12 font-medium text-base">
              Generate flashcards from notes, <br /> tests, and lecture slides.
            </p>
            <button className="bg-[#333333] font-medium text-white px-6 py-2 rounded-full">
              View Flashcards
            </button>
          </div>
        </Link>

        {/* Practice Questions Card */}
        <Link href="/dashboard/practice" className="group">
          <div className="bg-white p-8 rounded-xl flex flex-col items-center text-center transition-transform hover:-translate-y-1 shadow-[5px_5px_0_0px_rgba(51,51,51,1)]">
            <div className="mb-3">
              <LuBrain size={80} strokeWidth={1.5} className="text-[#333333]" />
            </div>
            <h2 className="text-4xl text-nowrap mb-4 font-semibold text-default">AI Practice Questions</h2>
            <p className="text-[#878787] mb-12 font-medium text-base">
              Generate practice problems from <br /> notes, tests, and lecture notes.
            </p>
            <button className="bg-[#333333] font-medium text-white px-6 py-2 rounded-full">
              View Practice Tests
            </button>
          </div>
        </Link>
      </div>
    </div>
  );
}
