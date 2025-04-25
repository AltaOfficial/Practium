"use server";
import { supabase } from "@/utils/supabase/server";
import { Database } from "@/utils/supabase/database.types";

type Question = Database["public"]["Tables"]["questions"]["Row"];

export async function getQuestions({ assessmentId }: { assessmentId: number }) {
  const questions = await supabase
    .from("questions")
    .select()
    .eq("assessment_id", assessmentId)
    .order("id", { ascending: true });

  if (questions.data) {
    return { data: questions.data };
  } else {
    return { error: "Error when fetching questions" };
  }
}

export async function getAssessment({
  assessmentId,
}: {
  assessmentId: number;
}) {
  const assessment = await supabase
    .from("assessments")
    .select()
    .eq("id", assessmentId)
    .order("id", { ascending: true });

  if (assessment.data) {
    return { data: assessment.data };
  } else {
    return { error: "Error when fetching assessment" };
  }
}

export async function sendCheckWithAI({
  question,
  answer,
  canvasPath,
}: {
  question: Question;
  answer: string;
  canvasPath?: string;
}) {
  if (!question || !answer) {
    return { error: "Missing question or answer" };
  }

  let res;
  if (question.question_type === "DRAWING") {
    const formData = new FormData();
    formData.append("question", JSON.stringify(question));
    formData.append("answer", answer);

    const response = await fetch("http://backend:8000/checkwithai", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return { error: "Failed to check answer with AI" };
    }

    res = await response.json();
  } else {
    const response = await fetch("http://backend:8000/checkwithai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: question, answer: answer }),
    });

    if (!response.ok) {
      return { error: "Failed to check answer with AI" };
    }

    res = await response.json();
  }

  if (res.correct == undefined || res.correct == null) {
    return {
      error: "Did not manage to get a right or wrong response, maybe try again",
    };
  }

  await supabase
    .from("questions")
    .update({
      is_answered: true,
      is_correct: res.correct,
      given_answer: question.question_type === "DRAWING" ? canvasPath : answer,
    })
    .eq("id", question.id);

  console.log(question.id);

  return { correct: res.correct };
}
