"use client";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAssesments } from "./actions";

type Assessment = Database["public"]["Tables"]["assessments"]["Row"];

export default function page() {
  const params = useParams();
  const [assessments, setAssessments] = useState<Assessment[]>();

  useEffect(() => {
    getAssesments(parseInt(params.course_id as string)).then(
      ({ data, error }) => {
        if (!data) {
          console.error(error);
        } else {
          setAssessments(data);
        }
      }
    );
  }, []);

  return (
    <div>
      <p className="text-3xl">Assessments</p>
      <div className="flex flex-col">
        {assessments &&
          assessments.map((assessment) => (
            <Link
              key={assessment.id}
              href={`/dashboard/practice/courses/${params.course_id}/assessments/${assessment.id}`}
            >
              {assessment.name}
            </Link>
          ))}
        <Link href={`/dashboard/practice/courses/${params.course_id}/generate`}>
          + Generate new assessment
        </Link>
      </div>
    </div>
  );
}
