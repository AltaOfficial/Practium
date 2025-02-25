import { supabase } from "@/utils/supabase/server";

export async function getAssesments({ courseId }: { courseId: string }) {
  let assesments = await supabase
    .from("assessments")
    .select()
    .eq("course_id", parseInt(courseId));

  if (assesments.data) {
    return { data: assesments.data };
  } else {
    return { error: "Error when fetching assessments" };
  }
}
