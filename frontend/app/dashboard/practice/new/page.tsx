"use client";
import { createNewCourse } from "./actions";
import { TextField, Button } from "@radix-ui/themes";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function page() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const hiddenFilesInput = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsCreating(true);
    try {
      await createNewCourse(formData);
      router.push('/dashboard/practice');
    } catch (error) {
      console.error(error);
    }
    setIsCreating(false);
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
            href="/dashboard/practice"
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span className="text-2xl">←</span>
            <span className="ml-2">Back to Courses</span>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Create New Course</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Set up a new course by providing course materials and resources
          </p>
        </div>

        <form action={handleSubmit} className="space-y-6 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          {/* Course Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Course Name
            </label>
            <TextField.Root 
              name="courseName"
              placeholder="Enter course name..."
              className="w-full"
            />
          </div>

          {/* URLs Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Resource URLs
            </label>
            <div className="flex gap-3">
              <TextField.Root
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter resource URL..."
                className="flex-1"
              />
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  if (urlInput.trim()) {
                    setUrls([...urls, urlInput.trim()]);
                    setUrlInput("");
                  }
                }}
              >
                Add URL
              </Button>
            </div>
            <input type="text" name="urls" readOnly hidden value={urls} />

            {/* URL List */}
            {urls.length > 0 && (
              <div className="space-y-2">
                {urls.map((url, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                      {url}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUrls(urls.filter(u => u !== url))}
                      className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Upload Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Course Materials
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-gray-200 dark:border-gray-700
                       rounded-lg flex items-center justify-center hover:border-gray-300 
                       dark:hover:border-gray-600 transition-colors"
            >
              <div className="text-center">
                <span className="block text-gray-600 dark:text-gray-400">Drop files here or click to upload</span>
                <span className="text-sm text-gray-500 dark:text-gray-500">Supports images and PDFs</span>
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
            <input
              type="file"
              ref={hiddenFilesInput}
              name="uploadedFiles"
              hidden
              readOnly
            />

            {/* File List */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
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

          {/* Submit Button */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={isCreating}
              className="w-full py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating Course..." : "Create Course"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
