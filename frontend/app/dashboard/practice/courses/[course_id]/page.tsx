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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center space-x-4 mb-8">
        <Link 
          href="/dashboard/practice"
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <span className="text-2xl">←</span>
          <span className="ml-2">Back to Courses</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Assessments</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          View your assessments or create a new one
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AssessementCard isGenerateCard={true} />
        {assessments && assessments.map((assessment) => (
          <AssessementCard key={assessment.id} assessment={assessment} />
        ))}
      </div>
    </div>
  );
}
