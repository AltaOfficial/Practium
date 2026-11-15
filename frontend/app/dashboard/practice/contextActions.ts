"use server";
import { supabase } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

// A file uploaded as class context. It is kept as text: the whole file
// (content) and what it says about how answers must be written (summary).
export type ContextFile = {
  id: string;
  name: string;
  content: string;
  summary: string;
};

export type CourseContext = {
  name: string;
  notes: string;
  files: ContextFile[];
  memory: string[];
};

// the signed-in user's course, or null
async function getOwnCourse(courseId: number) {
  const { userId } = await auth();
  if (!userId || Number.isNaN(courseId)) return null;
  const { data } = await supabase
    .from("courses")
    .select()
    .eq("id", courseId)
    .eq("user_id", userId);
  return data?.[0] ?? null;
}

export async function getCourseContext(
  courseId: number
): Promise<{ data?: CourseContext; error?: string }> {
  const course = await getOwnCourse(courseId);
  if (!course) return { error: "Course not found" };
  return {
    data: {
      name: course.name || "Untitled Course",
      notes: course.context_notes || "",
      files: (course.context_files as ContextFile[] | null) || [],
      memory: course.memory || [],
    },
  };
}

export async function saveCourseNotes(courseId: number, notes: string) {
  const course = await getOwnCourse(courseId);
  if (!course) return { error: "Course not found" };
  const { error } = await supabase
    .from("courses")
    .update({ context_notes: notes })
    .eq("id", course.id);
  return error ? { error: "Could not save the notes" } : { data: notes };
}

// memory is normally added from the tutor chat, but can be edited here too
export async function addCourseMemory(courseId: number, memory: string) {
  const course = await getOwnCourse(courseId);
  if (!course) return { error: "Course not found" };
  const text = memory.trim();
  if (!text) return { error: "Nothing to remember" };
  const memories = [...(course.memory || []), text];
  const { error } = await supabase
    .from("courses")
    .update({ memory: memories })
    .eq("id", course.id);
  return error ? { error: "Could not save the memory" } : { data: memories };
}

export async function deleteCourseMemory(courseId: number, index: number) {
  const course = await getOwnCourse(courseId);
  if (!course) return { error: "Course not found" };
  const memories = (course.memory || []).filter((_, i) => i !== index);
  const { error } = await supabase
    .from("courses")
    .update({ memory: memories })
    .eq("id", course.id);
  return error ? { error: "Could not delete the memory" } : { data: memories };
}

export async function deleteContextFile(courseId: number, fileId: string) {
  const course = await getOwnCourse(courseId);
  if (!course) return { error: "Course not found" };
  const files = ((course.context_files as ContextFile[] | null) || []).filter(
    (file) => file.id !== fileId
  );
  const { error } = await supabase
    .from("courses")
    .update({ context_files: files })
    .eq("id", course.id);
  return error ? { error: "Could not delete the file" } : { data: files };
}

// The backend turns the file into text and adds it to the course.
// formData holds "courseId" and "file".
export async function uploadContextFile(
  formData: FormData
): Promise<{ data?: ContextFile[]; error?: string }> {
  const cookieStore = await cookies();
  const { getToken } = await auth();
  const token = await getToken();

  try {
    const response = await fetch(
      `${
        process.env.VERCEL_ENV == "production"
          ? process.env.NEXT_PUBLIC_BACKEND_URL
          : "http://backend:8000"
      }/coursecontextfile`,
      {
        method: "POST",
        body: formData,
        headers: {
          Cookie: cookieStore.toString(),
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const result = await response.json();
    if (!response.ok || !result.context_files) {
      return { error: result.error || "Could not read this file" };
    }
    return { data: result.context_files };
  } catch (error) {
    console.error(error);
    return { error: "Could not read this file" };
  }
}
