"use server";
import { supabase } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

export async function getCourses() {
  const { userId } = await auth();
  if (!userId)
    return {
      error: "User not logged in/unable to get user id",
    };
  const { data: userCourses, error: userCoursesError } = await supabase
    .from("courses")
    .select()
    .eq("user_id", userId);

  console.log(userId);

  if (userCourses) {
    return { data: userCourses };
  } else {
    return { error: "Error when fetching courses: " + userCoursesError };
  }
}

export async function addCourse() {}
