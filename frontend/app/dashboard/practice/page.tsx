"use client";
import Coursecard from "@/components/Coursecard";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";
import { getCourses } from "./actions";

type Course = Database["public"]["Tables"]["courses"]["Row"];

export default function page() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    getCourses().then(({ data, error }) =>
      data ? setCourses(data) : console.log(error)
    );
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Practice</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Select a course to practice or create a new assessment
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <Coursecard isGenerateCard={true} />
        {courses && courses.map((course) => (
          <Coursecard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
