"use client";
import { generateFlashcards } from "../../../actions";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import Link from "next/link";
import { FiArrowLeft, FiCheck, FiX } from "react-icons/fi";

export default function GenerateFlashcardsPage() {
  const { course_id } = useParams();
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  // when on, the AI picks the number of cards from the material instead of using a fixed number
  const [matchMaterial, setMatchMaterial] = useState(true);
  const filesInput = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const content = ((form.get("content") as string) || "").trim();
    if (!content && uploadedFiles.length === 0) {
      setError("Add some content or a file");
      return;
    }

    // the files are kept in state (the file input only holds the last ones picked)
    const formData = new FormData();
    formData.set("courseId", course_id as string);
    formData.set("content", content);
    formData.set(
      "numOfCards",
      matchMaterial ? "auto" : (form.get("numOfCards") as string)
    );
    uploadedFiles.forEach((file) => formData.append("uploadedFiles", file));

    setError("");
    setIsGenerating(true);
    try {
      const result = await generateFlashcards(formData);
      if (result.data) {
        router.push(`/dashboard/memory/courses/${course_id}/decks/${result.data}`);
        return;
      }
      setError(result.error || "Could not generate flashcards");
    } catch (error) {
      // thrown when the request itself fails, for example when the files are too large
      console.error(error);
      setError("Could not generate flashcards. Are the files too large?");
    }
    setIsGenerating(false);
  };

  const addFiles = (fileList: FileList | null) => {
    if (fileList) setUploadedFiles((files) => [...files, ...Array.from(fileList)]);
    // lets the same file be picked again after it is removed
    if (filesInput.current) filesInput.current.value = "";
  };

  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-default mb-2">
            Generate New Flashcards
          </h1>
          <p className="text-[#878787] font-medium">
            Make flashcards from your notes, slides or a topic
          </p>
        </div>
        <Link
          href={`/dashboard/memory/courses/${course_id}`}
          className="flex items-center text-[#333333] font-medium gap-2 hover:opacity-80"
        >
          <FiArrowLeft size={20} />
          <span>Return to flashcards</span>
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
            />
          </div>

          <div>
            <label className="block text-default font-medium mb-2">
              Attachments
            </label>
            <div
              onClick={() => filesInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center cursor-pointer hover:border-[#333333] transition-colors"
            >
              <p className="text-gray-600 mb-1">
                Drop files here or click to upload
              </p>
              <p className="text-sm text-gray-500">
                Supports images, PDFs, slides (.pptx) and Word documents (.docx)
              </p>
              <input
                ref={filesInput}
                type="file"
                multiple
                accept="image/*,.pdf,.pptx,.docx"
                onChange={(e) => addFiles(e.target.files)}
                className="hidden"
              />
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setUploadedFiles((files) =>
                          files.filter((_, i) => i !== index)
                        )
                      }
                      className="!bg-transparent shrink-0 text-gray-500 hover:text-red-500"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="numOfCards"
              className="block text-default font-medium mb-2"
            >
              Number of Cards
            </label>
            <input
              type="number"
              id="numOfCards"
              name="numOfCards"
              min="1"
              max="100"
              defaultValue="20"
              disabled={matchMaterial}
              className="w-full px-4 py-1 rounded-md border text-default border-[#333333] focus:outline-none shadow-[3px_3px_0_0px_rgba(51,51,51,1)] disabled:opacity-50"
              required
            />
            <label className="flex items-center gap-3 mt-4 text-default font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={matchMaterial}
                onChange={(e) => setMatchMaterial(e.target.checked)}
                className="peer sr-only"
              />
              <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-[4px] border border-[#333333] bg-white text-transparent shadow-[1.5px_2px_0_0px_rgba(51,51,51,1)] transition-colors peer-checked:bg-[#333333] peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#333333]">
                <FiCheck size={14} strokeWidth={3} />
              </span>
              Let the AI choose how many cards
            </label>
          </div>

          {error && <p className="text-red-500 font-medium">{error}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isGenerating}
              className="bg-[#333333] mt-5 text-white px-4 py-1 rounded-full hover:opacity-90 disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate Flashcards"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
