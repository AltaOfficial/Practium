"use client";
import CourseCard from "@/components/Coursecard";
import { useCallback, useEffect, useState } from "react";
import CourseContext from "@/components/CourseContext";
import { Database } from "@/utils/supabase/database.types";
// the courses are the same ones the tests are in
import { getCourses } from "../practice/actions";
import { getDeckCounts } from "./actions";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

type Course = Database["public"]["Tables"]["courses"]["Row"];

export default function MemoryPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  // how many decks each course has
  const [deckCounts, setDeckCounts] = useState<Record<number, number>>({});
  // the course whose context is open
  const [contextCourse, setContextCourse] = useState<Course | null>(null);
  const closeContext = useCallback(() => setContextCourse(null), []);

  useEffect(() => {
    getCourses().then(({ data, error }) =>
      data ? setCourses(data) : console.log(error)
    );
    getDeckCounts().then(setDeckCounts);
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-default mb-2">Your Courses</h1>
          <p className="text-gray-500 font-medium">
            Select a course to save flashcards to
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center text-default font-medium gap-2 hover:opacity-80"
        >
          <FiArrowLeft size={25} />
          <span>Return to menu</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            courseName={course.name || "Untitled Course"}
            testsGenerated={deckCounts[course.id] || 0}
            countLabel={deckCounts[course.id] === 1 ? "deck" : "decks"}
            lastAccessed={"5 hours ago"}
            href={`/dashboard/memory/courses/${course.id}`}
            onContextClick={() => setContextCourse(course)}
          />
        ))}
      </div>

      {contextCourse && (
        <CourseContext
          courseId={contextCourse.id}
          courseName={contextCourse.name || "Untitled Course"}
          onClose={closeContext}
        />
      )}

      <div className="flex justify-center">
        <Link
          href="/dashboard/practice/new?from=memory"
          className="bg-[#333333] text-white px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
        >
          Create New Course
        </Link>
      </div>
    </div>
  );
}
