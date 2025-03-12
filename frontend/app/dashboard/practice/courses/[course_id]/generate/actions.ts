"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

export async function generateAssessment(formData: FormData) {
  const cookieStore = await cookies();
  const { getToken } = await auth();

  const token = await getToken();

  if (
    (formData.getAll("uploadedFiles")[0] as File).size == 0 &&
    !formData.get("textInput")
  ) {
    return;
  } else if (!formData.get("courseId") || !formData.get("numOfQuestions")) {
    return;
  }

  let response = await fetch(`http://backend:8000/generateassessement`, {
    method: "POST",
    body: formData,
    headers: {
      Cookie: cookieStore.toString(),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status == 200) {
    console.log(await response.json());
  }
  return redirect(`/dashboard/practice/courses/${formData.get("courseId")}`);
}
