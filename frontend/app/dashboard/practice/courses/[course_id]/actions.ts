"use server";
import { supabase } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

export async function getAssesments(courseId: number) {
  if (courseId == undefined) {
    return { error: "Course ID is not defined" };
  }

  const assesments = await supabase
    .from("assessments")
    .select()
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (assesments.data) {
    return { data: assesments.data };
  } else {
    return { error: "Error when fetching assessments" };
  }
}

export async function deleteAssessment(assessmentId: string) {
  const { userId } = await auth();
  if (!userId)
    return {
      error: "User not logged in/unable to get user id",
    };
  const { error } = await supabase
    .from("assessments")
    .delete()
    .eq("id", parseInt(assessmentId))
    .eq("user_id", userId);

  if (error) {
    return { error: "Error when deleting assessment" };
  } else {
    return { data: "Assessment deleted successfully" };
  }
}