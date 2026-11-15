"use client";
import Link from "next/link";
import { FiTrash } from "react-icons/fi";

type DeckCardProps = {
  name: string;
  totalCards: number;
  created: string;
  href: string;
  onDelete: () => void;
};

// A deck of flashcards in the list of decks.
export default function DeckCard({
  name,
  totalCards,
  created,
  href,
  onDelete,
}: DeckCardProps) {
  return (
    <div className="bg-white rounded-md p-6 flex gap-4 transition-transform hover:-translate-y-1 justify-between items-center border shadow-[5px_5px_0_0px_rgba(51,51,51,1)] border-[#333333]">
      <div className="flex-1 min-w-0">
        <h3 className="text-xl font-semibold text-default mb-2 truncate">
          {name}
        </h3>
        <div className="text-sm text-gray-500">
          <span>
            {totalCards} {totalCards === 1 ? "card" : "cards"}
          </span>
          <span className="mx-2">•</span>
          <span>Created {created}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={href}
          className="bg-[#333333] text-white text-sm px-10 py-2 rounded-md font-medium hover:opacity-90"
        >
          Study
        </Link>
        <button
          aria-label={`Delete ${name}`}
          onClick={onDelete}
          className="!bg-transparent text-gray-500 hover:text-red-500"
        >
          <FiTrash size={27} className="p-1" />
        </button>
      </div>
    </div>
  );
}
