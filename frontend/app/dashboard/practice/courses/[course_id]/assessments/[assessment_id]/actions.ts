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
  questionText,
  courseId,
}: {
  // the class the question belongs to, so the answer is graded the way that class expects
  courseId?: string;
  question: Question;
  answer: string;
  // the board's paths, when the answer is a drawing (of any question type);
  // answer is then an image of it
  canvasPath?: string;
  // full problem text to grade against, when it is more than question.question (parts of a multi-part question)
  questionText?: string;
}) {
  if (!question || !answer) {
    return { error: "Missing question or answer" };
  }

  const questionId = question.id;
  if (questionText) {
    question = { ...question, question: questionText };
  }

  let res;
  if (canvasPath) {
    const formData = new FormData();
    formData.append("question", JSON.stringify(question));
    formData.append("answer", answer);
    if (courseId) formData.append("course_id", courseId);

    const response = await fetch(`${process.env.VERCEL_ENV == "production" ? process.env.NEXT_PUBLIC_BACKEND_URL : "http://backend:8000"}/checkwithai`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return { error: "Failed to check answer with AI" };
    }

    res = await response.json();
  } else {
    console.log(process.env.VERCEL_ENV);
    console.log(process.env.NEXT_PUBLIC_BACKEND_URL);
    const response = await fetch(`${process.env.VERCEL_ENV == "production" ? process.env.NEXT_PUBLIC_BACKEND_URL : "http://backend:8000"}/checkwithai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: question,
        answer: answer,
        course_id: courseId,
      }),
    });
    console.log(response);

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
      given_answer: canvasPath || answer,
    })
    .eq("id", questionId);

  console.log(questionId);

  // feedback is an optional note from the grader on where the answer went wrong,
  // and marks what it wants drawn on a drawn answer to point at the mistakes
  return {
    correct: res.correct,
    feedback: typeof res.feedback === "string" ? res.feedback.trim() : "",
    marks: Array.isArray(res.marks) ? (res.marks as unknown[]) : [],
  };
}

// Saves a drawn answer again after the grader's marks were added to it.
export async function saveDrawing({
  questionId,
  canvasPath,
}: {
  questionId: number;
  canvasPath: string;
}) {
  await supabase
    .from("questions")
    .update({ given_answer: canvasPath })
    .eq("id", questionId);
}

// Swaps a question for a new one like it (same idea and shape, different
// specifics). questionIds are the question's rows: one, or every part of a
// multi-part question. Returns the rows as they are now.
export async function getSimilarQuestion({
  questionIds,
  courseId,
}: {
  questionIds: number[];
  courseId?: string;
}): Promise<{ data?: Question[]; error?: string }> {
  try {
    const response = await fetch(`${process.env.VERCEL_ENV == "production" ? process.env.NEXT_PUBLIC_BACKEND_URL : "http://backend:8000"}/similarquestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question_ids: questionIds, course_id: courseId }),
    });
    const res = await response.json();
    if (!response.ok || !Array.isArray(res.questions)) {
      return { error: res.error || "Could not make a similar question" };
    }
    return { data: res.questions };
  } catch (error) {
    console.error(error);
    return { error: "Could not make a similar question" };
  }
}
