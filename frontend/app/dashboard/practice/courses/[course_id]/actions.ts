"use server";
import { supabase } from "@/utils/supabase/server";

export async function getAssesments(courseId: number) {
  if (courseId == undefined) {
    return { error: "Course ID is not defined" };
  }

  let assesments = await supabase
    .from("assessments")
    .select()
    .eq("course_id", courseId);

  if (assesments.data) {
    return { data: assesments.data };
  } else {
    return { error: "Error when fetching assessments" };
  }
}
