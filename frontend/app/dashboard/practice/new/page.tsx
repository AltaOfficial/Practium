"use client";
import { createNewCourse } from "./actions";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

export default function CreateCoursePage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    
    const formData = new FormData(e.currentTarget);
    try {
      await createNewCourse(formData);
      router.push('/dashboard/practice');
    } catch (error) {
      console.error(error);
    }
    setIsCreating(false);
  };

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      setUrls([...urls, urlInput.trim()]);
      setUrlInput("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-default mb-2">Create New Course</h1>
          <p className="text-gray-500 font-medium">
            Create a new course by providing course materials and resources
          </p>
        </div>
        <Link 
          href="/dashboard/practice" 
          className="flex items-center text-default font-medium gap-2 hover:opacity-80"
        >
          <FiArrowLeft size={25} />
          <span>Return to courses</span>
        </Link>
      </div>

      <div className="bg-white p-8 rounded-2xl max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-default font-medium mb-2">
              Course Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Enter course name..."
              className="w-full px-4 py-1 rounded-md border text-default border-[#333333] focus:outline-none shadow-[3px_3px_0_0px_rgba(51,51,51,1)]"
              required
            />
          </div>

          <div>
            <label className="block text-default font-medium mb-2">
              Resource URLs
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter course name..."
                className="flex-1 px-4 py-1 rounded-md border text-default border-[#333333] focus:outline-none shadow-[3px_3px_0_0px_rgba(51,51,51,1)]"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="bg-[#333333] text-white text-sm px-5 py-1 rounded-md font-medium hover:opacity-90"
              >
                Add URL(s)
              </button>
            </div>
            {urls.length > 0 && (
              <div className="mt-2 space-y-1">
                {urls.map((url, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    {url}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-default font-medium mb-2 mt-10">
              Course Materials
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center cursor-pointer hover:border-[#333333] transition-colors"
            >
              <p className="text-gray-600 mb-1">Drop files here or click to upload</p>
              <p className="text-sm text-gray-500">Supports images and PDFs</p>
              <input
                ref={fileInputRef}
                type="file"
                name="files"
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

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isCreating}
              className="bg-[#333333] mt-5 text-white px-4 py-1 rounded-full hover:opacity-90 disabled:opacity-50"
            >
              Create Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
