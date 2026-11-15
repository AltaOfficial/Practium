"use client";
import { MathJax } from "better-react-mathjax";

type FlashcardProps = {
  term: string;
  definition: string;
  // true when the back (the definition) is showing
  flipped: boolean;
  onFlip: () => void;
};

const faceClassName =
  "absolute inset-0 flex flex-col bg-white rounded-xl border border-[#333333] shadow-[5px_5px_0_0px_rgba(51,51,51,1)] p-8 overflow-y-auto [backface-visibility:hidden]";

// A card that flips between its term and its definition when clicked.
export default function Flashcard({
  term,
  definition,
  flipped,
  onFlip,
}: FlashcardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={flipped ? "Show term" : "Show definition"}
      onClick={onFlip}
      className="h-[380px] cursor-pointer select-none outline-none [perspective:1600px]"
    >
      <div
        className={`relative h-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateX(180deg)]" : ""
        }`}
      >
        <div className={faceClassName}>
          {/* m-auto centers the text, and still lets a long one scroll from its start */}
          <div className="m-auto text-center text-2xl font-semibold text-default">
            <MathJax dynamic>{term}</MathJax>
          </div>
        </div>
        <div className={`${faceClassName} [transform:rotateX(180deg)]`}>
          <div className="m-auto text-center text-xl font-medium text-default whitespace-pre-line">
            <MathJax dynamic>{definition}</MathJax>
          </div>
        </div>
      </div>
    </div>
  );
}
