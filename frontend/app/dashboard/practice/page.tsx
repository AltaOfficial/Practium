"use client";
import CourseCard from "@/components/Coursecard";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";
import { getCourses } from "./actions";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

type Course = Database["public"]["Tables"]["courses"]["Row"] & {
  total_tests?: number;
  last_accessed?: string;
};

export default function PracticePage() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    getCourses().then(({ data, error }) =>
      data ? setCourses(data) : console.log(error)
    );
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-default mb-2">Your Courses</h1>
          <p className="text-gray-500 font-medium">
            Select a course to save generated tests to
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
            testsGenerated={course.total_tests || 0}
            lastAccessed={"5 hours ago"}
            href={`/dashboard/practice/courses/${course.id}`}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <Link
          href="/dashboard/practice/new"
          className="bg-[#333333] text-white px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
        >
          Create New Course
        </Link>
      </div>
    </div>
  );
}
