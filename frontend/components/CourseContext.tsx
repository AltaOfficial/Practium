"use client";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiTrash2, FiX } from "react-icons/fi";
import {
  ContextFile,
  getCourseContext,
  saveCourseNotes,
  addCourseMemory,
  deleteCourseMemory,
  deleteContextFile,
  uploadContextFile,
} from "@/app/dashboard/practice/contextActions";

const inputStyle =
  "w-full px-4 py-2 rounded-md border !bg-white !text-[#333333] border-[#333333] focus:outline-none shadow-[3px_3px_0_0px_rgba(51,51,51,1)]";
const darkButton =
  "bg-[#333333] text-white text-sm px-5 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50";

// A dialog for the context of a class: what the AI should know when it writes
// tests and solutions and grades answers for it.
export default function CourseContext({
  courseId,
  courseName,
  onClose,
}: {
  courseId: number;
  courseName: string;
  onClose: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");

  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [files, setFiles] = useState<ContextFile[]>([]);
  // names of the files being turned into text right now
  const [readingFiles, setReadingFiles] = useState<string[]>([]);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [memory, setMemory] = useState<string[]>([]);
  const [memoryInput, setMemoryInput] = useState("");

  useEffect(() => {
    getCourseContext(courseId).then(({ data, error }) => {
      if (!data) return setError(error || "Could not load the class");
      setNotes(data.notes);
      setSavedNotes(data.notes);
      setFiles(data.files);
      setMemory(data.memory);
      setIsLoaded(true);
    });
  }, [courseId]);

  // Escape closes the dialog, and the page behind it doesn't scroll
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const saveNotes = async () => {
    setIsSavingNotes(true);
    const result = await saveCourseNotes(courseId, notes);
    if (result.error) setError(result.error);
    else setSavedNotes(notes);
    setIsSavingNotes(false);
  };

  // files are read one at a time, each is added to the class as soon as it is done
  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    setError("");
    setReadingFiles((reading) => [...reading, ...newFiles.map((f) => f.name)]);
    for (const file of newFiles) {
      const formData = new FormData();
      formData.append("courseId", String(courseId));
      formData.append("file", file);
      const result = await uploadContextFile(formData).catch(() => ({
        data: undefined,
        error: `Could not upload ${file.name}. It may be too large.`,
      }));
      if (result.data) setFiles(result.data);
      else setError(result.error || `Could not read ${file.name}`);
      setReadingFiles((reading) => {
        const index = reading.indexOf(file.name);
        return reading.filter((_, i) => i !== index);
      });
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeFile = async (fileId: string) => {
    const result = await deleteContextFile(courseId, fileId);
    if (result.data) setFiles(result.data);
    else setError(result.error || "Could not delete the file");
  };

  const addMemory = async () => {
    if (!memoryInput.trim()) return;
    const result = await addCourseMemory(courseId, memoryInput);
    if (result.data) {
      setMemory(result.data);
      setMemoryInput("");
    } else setError(result.error || "Could not save the memory");
  };

  const removeMemory = async (index: number) => {
    const result = await deleteCourseMemory(courseId, index);
    if (result.data) setMemory(result.data);
    else setError(result.error || "Could not delete the memory");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Context for ${courseName}`}
        className="bg-white w-full max-w-3xl rounded-2xl shadow-[5px_5px_0_0px_rgba(51,51,51,1)] divide-y divide-gray-200"
      >
        <div className="flex justify-between items-start gap-4 p-8">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-default mb-1 truncate">
              {courseName}
            </h2>
            <p className="text-sm text-[#878787] font-medium">
              Class context
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#333333] hover:opacity-70 shrink-0"
          >
            <FiX size={24} />
          </button>
        </div>

        {error && (
          <div className="px-8 py-3 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Notes */}
        <section className="p-8">
          <h3 className="text-xl font-semibold text-default mb-1">Notes</h3>
          <p className="text-sm text-gray-500 mb-4">
            How the professor wants answers written and graded.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isLoaded}
            rows={5}
            placeholder="e.g. Every answer has to explain each step in words."
            className={inputStyle}
          />
          <div className="flex justify-end mt-4">
            <button
              onClick={saveNotes}
              disabled={!isLoaded || isSavingNotes || notes === savedNotes}
              className={darkButton}
            >
              {isSavingNotes
                ? "Saving..."
                : notes === savedNotes && isLoaded
                ? "Saved"
                : "Save notes"}
            </button>
          </div>
        </section>

        {/* Example files */}
        <section className="p-8">
          <h3 className="text-xl font-semibold text-default mb-1">
            Example material
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Worked solutions, graded work or a rubric.
          </p>
          <div
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              uploadFiles(e.dataTransfer.files);
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
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,.pdf,.pptx,.docx"
              onChange={(e) => uploadFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {(files.length > 0 || readingFiles.length > 0) && (
            <ul className="mt-4 space-y-3">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="border border-gray-200 rounded-md p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-default truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                        {file.summary}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      aria-label={`Remove ${file.name}`}
                      className="text-gray-400 hover:text-red-500 shrink-0 mt-1"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      setOpenFileId(openFileId === file.id ? null : file.id)
                    }
                    className="flex items-center gap-1 text-sm font-medium text-[#333333] mt-3"
                  >
                    <FiChevronDown
                      size={16}
                      className={`transition-transform ${
                        openFileId === file.id ? "rotate-180" : ""
                      }`}
                    />
                    {openFileId === file.id ? "Hide" : "Show"} the full text
                  </button>
                  {openFileId === file.id && (
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700 bg-gray-50 rounded-md p-3 font-sans">
                      {file.content}
                    </pre>
                  )}
                </li>
              ))}
              {readingFiles.map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  className="border border-gray-200 rounded-md p-4 animate-pulse"
                >
                  <p className="font-medium text-default truncate">{name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Uploading...
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Memory */}
        <section className="p-8">
          <h3 className="text-xl font-semibold text-default mb-1">Memory</h3>
          <p className="text-sm text-gray-500 mb-4">
            What the tutor has learned about this class from your chats.
          </p>
          {memory.length > 0 ? (
            <ul className="space-y-2 mb-4">
              {memory.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start justify-between gap-4 border border-gray-200 rounded-md px-4 py-2.5"
                >
                  <span className="text-sm text-default">{item}</span>
                  <button
                    onClick={() => removeMemory(index)}
                    aria-label="Forget this"
                    className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 mb-4">
              {isLoaded ? "Nothing yet." : "Loading..."}
            </p>
          )}
          <div className="flex gap-3">
            <input
              type="text"
              value={memoryInput}
              onChange={(e) => setMemoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMemory();
              }}
              disabled={!isLoaded}
              placeholder="Add a note..."
              className={inputStyle + " !py-1"}
            />
            <button
              onClick={addMemory}
              disabled={!isLoaded || !memoryInput.trim()}
              className={darkButton + " shrink-0"}
            >
              Add
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
