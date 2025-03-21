"use client";
import { generateAssessment } from "./actions";
import { useParams, useRouter } from "next/navigation";
import { TextArea, Button } from "@radix-ui/themes";
import { useState, useRef } from "react";
import Link from "next/link";

export default function page() {
  const params = useParams();
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const hiddenFilesInput = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsGenerating(true);
    try {
      await generateAssessment(formData);
      router.push(`/dashboard/practice/courses/${params.course_id}`);
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
        [...uploadedFiles, ...newFiles].forEach(file => dataTransfer.items.add(file));
        hiddenFilesInput.current.files = dataTransfer.files;
      }
      e.target.value = "";
    }
  };

  const removeFile = (fileToRemove: File) => {
    const updatedFiles = uploadedFiles.filter(file => file !== fileToRemove);
    setUploadedFiles(updatedFiles);
    
    if (hiddenFilesInput.current) {
      const dataTransfer = new DataTransfer();
      updatedFiles.forEach(file => dataTransfer.items.add(file));
      hiddenFilesInput.current.files = dataTransfer.files;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Link 
            href={`/dashboard/practice/courses/${params.course_id}`}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span className="text-2xl">←</span>
            <span className="ml-2">Back to Assessments</span>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Generate Assessment</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Create a new assessment by providing content and customizing options
          </p>
        </div>

        <form action={handleSubmit} className="space-y-6 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          {/* Hidden file inputs */}
          <input type="file" ref={hiddenFilesInput} name="uploadedFiles" hidden readOnly multiple />
          <input hidden readOnly name="courseId" value={params.course_id} type="text" />

          {/* Main content area */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content
              </label>
              <TextArea
                name="textInput"
                placeholder="Enter your content here or upload files below..."
                className="min-h-[200px] w-full p-4 rounded-lg border border-gray-200 dark:border-gray-700 
                          bg-white dark:bg-black/40 text-gray-900 dark:text-gray-100
                          focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* File upload section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Attachments
              </label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-200 dark:border-gray-700
                           rounded-lg flex items-center justify-center hover:border-gray-300 
                           dark:hover:border-gray-600 transition-colors"
                >
                  <div className="text-center">
                    <span className="block text-gray-600 dark:text-gray-400">Drop files here or click to upload</span>
                    <span className="text-sm text-gray-500">Supports images and PDFs</span>
                  </div>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf"
                  className="hidden"
                  multiple
                />

                {/* File list */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-black/60 rounded-lg">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(file)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Options section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Questions
              </label>
              <input
                type="number"
                name="numOfQuestions"
                defaultValue={10}
                min={1}
                max={50}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 
                         bg-white dark:bg-black/40 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate Assessment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
