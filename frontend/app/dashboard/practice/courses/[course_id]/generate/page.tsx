"use client";
import { generateAssessment } from "./actions";
import { useParams } from "next/navigation";
import { TextArea } from "@radix-ui/themes";

export default function page() {
  const params = useParams();

  return (
    <form action={generateAssessment} className="flex flex-col">
      <input type="file" name="imageInput" />
      <TextArea
        name="textInput"
        className="border-white border-2 outline-none bg-black pl-2"
      ></TextArea>
      <input
        type="number"
        name="numOfQuestions"
        defaultValue={10}
        className="border-white border-2 outline-none bg-black pl-2"
      />
      <button type="submit">Generate assesment</button>
      <input
        hidden
        readOnly
        name="courseId"
        value={params.course_id}
        type="text"
      />
    </form>
  );
}
