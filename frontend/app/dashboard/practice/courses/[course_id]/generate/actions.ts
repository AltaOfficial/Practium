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
    !formData.get("content")
  ) {
    console.log("No content or files uploaded");
    return;
  } else if (!formData.get("courseId") || !formData.get("numOfQuestions")) {
    console.log("No courseId or numOfQuestions");
    return;
  }

  console.log(formData);
  console.log(process.env.VERCEL_ENV);
  console.log(process.env.BACKEND_URL);
  const response = await fetch(`${process.env.VERCEL_ENV == "production" ? process.env.BACKEND_URL : "http://backend:8000"}/generateassessement`, {
    method: "POST",
    body: formData,
    headers: {
      Cookie: cookieStore.toString(),
      Authorization: `Bearer ${token}`,
    },
  });

  console.log(response);

  if (response.status == 200) {
    console.log(await response.json());
  }
  return redirect(`/dashboard/practice/courses/${formData.get("courseId")}`);
}
