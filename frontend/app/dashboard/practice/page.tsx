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
      <p className="text-3xl">Practice</p>
      {courses &&
        courses.map((course) => {
          return <Coursecard key={course.id} course={course} />;
        })}
    </div>
  );
}
