"use client";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";
import Link from "next/link";
import { useParams } from "next/navigation";

type Assessment = Database["public"]["Tables"]["assessments"]["Row"];

export default function page() {
  const params = useParams();
  const [assessments, setAssessments] = useState<Assessment[]>();

  useEffect(() => {}, []);

  return (
    <div>
      <p className="text-3xl">Assessments</p>
      {assessments &&
        assessments.map((assessment) => (
          <Link href={""}>{assessment.name}</Link>
        ))}
      <Link href={`/dashboard/practice/course/${params.slug}/generate`}>
        + Generate new assessment
      </Link>
    </div>
  );
}
