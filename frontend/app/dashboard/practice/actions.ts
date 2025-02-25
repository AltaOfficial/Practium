"use server";
import { supabase } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

export async function getCourses() {
  const { userId } = await auth();
  if (!userId)
    return {
      error: "User not logged in/unable to get user id",
    };
  const userCourses = await supabase
    .from("courses")
    .select()
    .eq("user_id", userId);

  console.log(userId);
  if (userCourses.data) {
    return { data: userCourses.data };
  } else {
    return { error: "Error when fetching courses" };
  }
}

export async function addCourse() {}
