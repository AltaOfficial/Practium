"use client";
import { useRouter } from "next/navigation";
import { FiTrash } from "react-icons/fi";

type AssessmentCardProps = {
  title: string;
  totalQuestions: number;
  answeredQuestions: number;
  lastAccessed: string;
  course_id: string;
  assessment_id: string;
  deleteAssessment: (assessmentId: string) => void;
}

export default function AssessmentCard({
  title,
  totalQuestions,
  answeredQuestions,
  lastAccessed,
  course_id,
  assessment_id,
  deleteAssessment
}: AssessmentCardProps) {
  const router = useRouter();
  
  return (
    <div className="bg-white rounded-md p-6 flex transition-transform hover:-translate-y-1 justify-between items-center border shadow-[5px_5px_0_0px_rgba(51,51,51,1)] border-[#333333]">
      <div className="flex-1">
        <h3 className="text-xl font-semibold text-default mb-2 truncate">
          {title}
        </h3>
        <div className="text-sm text-gray-500">
          <span>{totalQuestions} questions</span>
          <span className="mx-1">/</span>
          <span>{answeredQuestions} answered</span>
          <span className="mx-2">•</span>
          <span>Last accessed {lastAccessed}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            router.push(`/dashboard/practice/courses/${course_id}/assessments/${assessment_id}`);
          }}
          className="bg-[#333333] text-white text-sm px-10 py-2 rounded-md font-medium hover:opacity-90"
        >
          Start
        </button>
        <FiTrash
          size={27}
          className="text-gray-500 hover:text-red-500 p-1 hover:cursor-pointer"
          onClick={() => {
            deleteAssessment(assessment_id);
          }}
        />
      </div>
    </div>
  );
}
