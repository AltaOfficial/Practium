"use server";
import { supabase } from "@/utils/supabase/server";

export async function getAssessment({
  assessmentId,
}: {
  assessmentId: number;
}) {
  const questions = await supabase
    .from("questions")
    .select()
    .eq("assessment_id", assessmentId);

  if (questions.data) {
    return { data: questions.data };
  } else {
    return { error: "Error when fetching assessments" };
  }
}

export async function checkWithAI({
  question,
  answer,
}: {
  question: string | undefined;
  answer: string | undefined;
}) {
  if (question == undefined || answer == undefined) {
    return { error: "Missing question or answer" };
  }
  let res = await fetch("http://backend/checkwithai", {
    method: "POST",
    body: JSON.stringify({ question: question, answer: answer }),
  });
}
