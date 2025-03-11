"use client";
import { createNewCourse } from "./actions";
import { TextField, Button } from "@radix-ui/themes";
import { useState, useRef } from "react";
import { FiTrash, FiChevronLeft } from "react-icons/fi";
import Link from "next/link";

export default function page() {
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const hiddenFilesInput = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div>
        <Link href={"/dashboard/practice"}>
          <FiChevronLeft />
        </Link>
      </div>
      <form action={createNewCourse} className="flex flex-col gap-3 p-2">
        <div>
          <TextField.Root placeholder="Name" name="courseName" />
        </div>
        <div className="flex justify-between">
          <div>
            <div className="flex gap-3">
              <TextField.Root
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                }}
                placeholder="Urls"
              />
              <Button
                className="hover:cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  if (urlInput != "") {
                    setUrls([...urls, urlInput]);
                    setUrlInput("");
                  }
                }}
              >
                Add URL
              </Button>
              <input type="text" name="urls" readOnly hidden value={urls} />
            </div>
            <div>
              {urls.map((url, index) => {
                return (
                  <div key={index} className="flex place-items-center gap-2">
                    <p>{url}</p>
                    <FiTrash
                      color="red"
                      className="hover:cursor-pointer"
                      onClick={() => {
                        setUrls(urls.filter((urlItem) => urlItem != url));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div>
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
                                (uploadedFileItem) =>
                                  uploadedFileItem != uploadedFile
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
            <input
              type="file"
              ref={hiddenFilesInput}
              name="uploadedFiles"
              hidden
              readOnly
            />
          </div>
        </div>
        <div className=" fixed bottom-0 right-0 p-8">
          <Button type="submit">Create Course</Button>
        </div>
      </form>
    </div>
  );
}
