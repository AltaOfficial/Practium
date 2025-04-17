"use client";
import { generateAssessment } from "./actions";
import { useParams, useRouter } from "next/navigation";
import { TextArea, Button } from "@radix-ui/themes";
import { useState, useRef } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export default function GenerateTestPage() {
  const { course_id } = useParams();
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const hiddenFilesInput = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGenerating(true);

    const formData = new FormData(e.currentTarget);
    try {
      await generateAssessment(formData);
      router.push(`/dashboard/practice/courses/${course_id}`);
    } catch (error) {
      console.error(error);
    }
    setIsGenerating(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);

      if (hiddenFilesInput.current) {
        const dataTransfer = new DataTransfer();
        [...uploadedFiles, ...newFiles].forEach((file) =>
          dataTransfer.items.add(file)
        );
        hiddenFilesInput.current.files = dataTransfer.files;
      }
      e.target.value = "";
    }
  };

  const removeFile = (fileToRemove: File) => {
    const updatedFiles = uploadedFiles.filter((file) => file !== fileToRemove);
    setUploadedFiles(updatedFiles);

    if (hiddenFilesInput.current) {
      const dataTransfer = new DataTransfer();
      updatedFiles.forEach((file) => dataTransfer.items.add(file));
      hiddenFilesInput.current.files = dataTransfer.files;
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-default mb-2">
            Generate New Test
          </h1>
          <p className="text-[#878787] font-medium">
            Create a new test by providing additional materials or using
            existing course content
          </p>
        </div>
        <Link
          href={`/dashboard/practice/courses/${course_id}`}
          className="flex items-center text-[#333333] font-medium gap-2 hover:opacity-80"
        >
          <FiArrowLeft size={20} />
          <span>Return to tests</span>
        </Link>
      </div>

      <div className="bg-white p-8 rounded-2xl max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="content"
              className="block text-default font-medium mb-2"
            >
              Content
            </label>
            <textarea
              id="content"
              name="content"
              rows={3}
              placeholder="Enter your content here or upload files below..."
              className="w-full px-4 py-1 rounded-md border text-default border-[#333333] focus:outline-none shadow-[3px_3px_0_0px_rgba(51,51,51,1)]"
              required
            />
            <input
              type="text"
              name="courseId"
              value={course_id}
              hidden
              readOnly
            />
          </div>

          <div>
            <label className="block text-default font-medium mb-2">
              Attachments
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center cursor-pointer hover:border-[#333333] transition-colors"
            >
              <p className="text-gray-600 mb-1">
                Drop files here or click to upload
              </p>
              <p className="text-sm text-gray-500">Supports images and PDFs</p>
              <input
                ref={fileInputRef}
                type="file"
                name="uploadedFiles"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    {file.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="numOfQuestions"
              className="block text-default font-medium mb-2"
            >
              Number of Questions
            </label>
            <input
              type="number"
              id="numOfQuestions"
              name="numOfQuestions"
              min="1"
              max="50"
              defaultValue="10"
              className="w-full px-4 py-1 rounded-md border text-default border-[#333333] focus:outline-none shadow-[3px_3px_0_0px_rgba(51,51,51,1)]"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isGenerating}
              className="bg-[#333333] mt-5 text-white px-4 py-1 rounded-full hover:opacity-90 disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
