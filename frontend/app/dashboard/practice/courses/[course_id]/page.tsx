"use client";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAssesments } from "./actions";
import AssessmentCard from "@/components/AssessmentCard";
import { FiArrowLeft } from "react-icons/fi";

type Assessment = Database["public"]["Tables"]["assessments"]["Row"];

export default function CourseTestsPage() {
  const { course_id } = useParams();
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    getAssesments(parseInt(course_id as string)).then((result) => {
      if (result.data) {
        setAssessments(result.data);
      } else if (result.error) {
        console.error(result.error);
      }
    });
  }, [course_id]);

  return (
    <div className="max-w-7xl mx-auto py-12 pb-28">
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-default mb-2">Your Tests</h1>
          <p className="text-[#878787] font-medium">
            Review and practice your generated assessments
          </p>
        </div>
        <Link
          href="/dashboard/practice"
          className="flex items-center gap-2 text-[#333333] font-medium hover:opacity-80"
        >
          <FiArrowLeft size={20} />
          <span>Return to courses</span>
        </Link>
      </div>

      <div className="space-y-6">
        {assessments.map((assessment) => (
          <AssessmentCard
            key={assessment.id}
            title={assessment.name || "Untitled Assessment"}
            totalQuestions={assessment.total_questions || 0}
            answeredQuestions={0}
            lastAccessed={assessment.created_at ? new Date(assessment.created_at).toLocaleDateString() : "Never"}
            course_id={course_id as string}
            assessment_id={assessment.id.toString()}
          />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center">
        <Link 
          href={`/dashboard/practice/courses/${course_id}/generate`}
          className="bg-[#333333] text-white px-6 py-3 rounded-full font-medium transition-transform hover:-translate-y-1"
        >
          Generate New Test
        </Link>
      </div>
    </div>
  );
}
