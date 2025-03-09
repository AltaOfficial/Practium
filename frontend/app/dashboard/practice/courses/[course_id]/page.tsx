"use client";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAssesments } from "./actions";
import AssessementCard from "@/components/AssessmentCard";

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
      <p className="text-4xl mb-3">Assessments</p>
      <div className="flex flex-row flex-wrap gap-3">
        {assessments &&
          assessments.map((assessment) => (
            <AssessementCard key={assessment.id} assessment={assessment} />
          ))}
        <AssessementCard isGenerateCard={true} />
      </div>
    </div>
  );
}
