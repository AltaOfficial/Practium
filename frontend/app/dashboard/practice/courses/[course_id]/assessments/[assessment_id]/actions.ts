"use server";
import { supabase } from "@/utils/supabase/server";
import { Database } from "@/utils/supabase/database.types";

type Question = Database["public"]["Tables"]["questions"]["Row"];

export async function getAssessment({
  assessmentId,
}: {
  assessmentId: number;
}) {
  const questions = await supabase
    .from("questions")
    .select()
    .eq("assessment_id", assessmentId)
    .order("id", { ascending: true });

  if (questions.data) {
    return { data: questions.data };
  } else {
    return { error: "Error when fetching assessments" };
  }
}

export async function sendCheckWithAI({
  question,
  answer,
}: {
  question: Question;
  answer: string | undefined | null;
}) {
  if (!question || !answer) {
    return { error: "Missing question or answer" };
  }
  let res = await (
    await fetch("http://backend:8000/checkwithai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: question, answer: answer }),
    })
  ).json();

  if (res.correct == undefined || res.correct == null) {
    return {
      error: "Did not manage to get a right or wrong response, maybe try again",
    };
  }

  await supabase
    .from("questions")
    .update({ is_answered: true, is_correct: res.correct })
    .eq("id", question.id);

  console.log(question.id);

  return { correct: res.correct };
}
