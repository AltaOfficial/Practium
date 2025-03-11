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
    <div>
      <p className="text-4xl mb-3">Practice</p>
      <div className="flex flex-row flex-wrap gap-3">
        {courses &&
          courses.map((course) => {
            return <Coursecard key={course.id} course={course} />;
          })}
        <Coursecard isGenerateCard={true} />
      </div>
    </div>
  );
}
