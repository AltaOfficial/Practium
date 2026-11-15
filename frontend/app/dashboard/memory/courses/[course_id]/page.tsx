"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import DeckCard from "@/components/DeckCard";
import { getDecks, deleteDeck, type Deck } from "../../actions";

export default function CourseFlashcardsPage() {
  const { course_id } = useParams();
  // null while the decks are loading
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDecks(parseInt(course_id as string)).then((result) => {
      setDecks(result.data || []);
      setError(result.error || "");
    });
  }, [course_id]);

  const handleDelete = async (deck: Deck) => {
    if (!window.confirm(`Delete "${deck.name || "Untitled Flashcards"}"?`)) {
      return;
    }
    const result = await deleteDeck(deck.id);
    if (result.error) {
      setError(result.error);
    } else {
      setDecks((decks) => (decks || []).filter((d) => d.id !== deck.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12 pb-28">
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-default mb-2">
            Your Flashcards
          </h1>
          <p className="text-[#878787] font-medium">
            Study the flashcards made from your material
          </p>
        </div>
        <Link
          href="/dashboard/memory"
          className="flex items-center gap-2 text-[#333333] font-medium hover:opacity-80"
        >
          <FiArrowLeft size={20} />
          <span>Return to courses</span>
        </Link>
      </div>

      {error && <p className="text-red-500 font-medium mb-6">{error}</p>}

      {decks && decks.length === 0 && !error && (
        <p className="text-[#878787] font-medium text-center py-16">
          No flashcards yet
        </p>
      )}

      <div className="space-y-6">
        {(decks || []).map((deck) => (
          <DeckCard
            key={deck.id}
            name={deck.name || "Untitled Flashcards"}
            totalCards={deck.total_cards}
            created={new Date(deck.created_at).toLocaleDateString()}
            href={`/dashboard/memory/courses/${course_id}/decks/${deck.id}`}
            onDelete={() => handleDelete(deck)}
          />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center">
        <Link
          href={`/dashboard/memory/courses/${course_id}/new`}
          className="bg-[#333333] text-white px-6 py-3 rounded-full font-medium transition-transform hover:-translate-y-1"
        >
          Generate New Flashcards
        </Link>
      </div>
    </div>
  );
}
