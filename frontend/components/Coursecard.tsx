import Link from "next/link";
import { Database } from "@/utils/supabase/database.types";

type Course = Database["public"]["Tables"]["courses"]["Row"];

export default function Coursecard({ course }: { course: Course }) {
  return (
    <div className="">
      <Link href={`/dashboard/practice/courses/${course.id}`}>
        {course.name}
      </Link>
    </div>
  );
}
