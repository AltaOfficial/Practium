"use client";
import { generateAssessment } from "./actions";
import { useParams } from "next/navigation";
import { TextArea, Button } from "@radix-ui/themes";
import { useState, useRef } from "react";
import { FiTrash } from "react-icons/fi";

export default function page() {
  const params = useParams();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const hiddenFilesInput = useRef<HTMLInputElement>(null);

  return (
    <form action={generateAssessment} className="flex flex-col">
      <input
        type="file"
        onChange={(e) => {
          if (e.target.files) {
            setUploadedFiles([...uploadedFiles, e.target.files[0]]);
            let hiddenFileInput = hiddenFilesInput.current;
            if (hiddenFileInput) {
              const dataTransfer = new DataTransfer();
              for (let file of e.target.files) {
                dataTransfer.items.add(file);
              }
              for (let file of uploadedFiles) {
                dataTransfer.items.add(file);
              }
              hiddenFileInput.files = dataTransfer.files;
            }
            e.target.value = "";
          }
        }}
        placeholder="Upload file"
        accept="image/*,.pdf"
      />
      <input
        type="file"
        ref={hiddenFilesInput}
        name="uploadedFiles"
        hidden
        readOnly
      />

      <div>
        {uploadedFiles &&
          uploadedFiles.map((uploadedFile, index) => {
            return (
              <div key={index} className="flex place-items-center gap-2">
                <p>{uploadedFile.name}</p>
                <FiTrash
                  color="red"
                  className="hover:cursor-pointer"
                  onClick={() => {
                    if (hiddenFilesInput.current) {
                      setUploadedFiles(
                        uploadedFiles.filter(
                          (uploadedFileItem) => uploadedFileItem != uploadedFile
                        )
                      );

                      const dataTransfer = new DataTransfer();
                      for (let file of uploadedFiles) {
                        if (file != uploadedFile) {
                          dataTransfer.items.add(file);
                        }
                      }
                      hiddenFilesInput.current.files = dataTransfer.files;
                      console.log(hiddenFilesInput.current.files);
                    }
                  }}
                />
              </div>
            );
          })}
      </div>
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
      <div className="m-auto mt-2">
        <Button type="submit">Generate assesment</Button>
      </div>
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
