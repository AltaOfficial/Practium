"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight, FiShuffle } from "react-icons/fi";
import Flashcard from "@/components/Flashcard";
import { getDeck, type Card } from "../../../../actions";

const roundButtonClassName =
  "w-11 h-11 flex items-center justify-center rounded-full border border-[#333333] !bg-white text-[#333333] shadow-[2px_2px_0_0px_rgba(51,51,51,1)] hover:opacity-80 disabled:opacity-40";

export default function StudyFlashcardsPage() {
  const { course_id, deck_id } = useParams();
  const [deckName, setDeckName] = useState("");
  // the cards in the order they are studied, null while loading
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    getDeck(parseInt(deck_id as string)).then((result) => {
      if (result.data) {
        setDeckName(result.data.deck.name || "Untitled Flashcards");
        setCards(result.data.cards);
      } else {
        setCards([]);
        setError(result.error || "Flashcards not found");
      }
    });
  }, [deck_id]);

  const total = cards?.length || 0;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return;
      setCurrent(index);
      setFlipped(false);
    },
    [total]
  );

  const shuffle = () => {
    if (!cards) return;
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setCards(shuffled);
    setCurrent(0);
    setFlipped(false);
  };

  // space or enter flips the card, the arrows move between cards
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        // a focused button or link handles these keys itself
        if ((e.target as HTMLElement).closest("button, a")) return;
        e.preventDefault();
        setFlipped((flipped) => !flipped);
      } else if (e.key === "ArrowRight") {
        goTo(current + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(current - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, goTo]);

  const card = cards?.[current];

  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="flex justify-between items-center gap-6 mb-8">
        <h1 className="text-4xl font-bold text-default truncate">{deckName}</h1>
        <Link
          href={`/dashboard/memory/courses/${course_id}`}
          className="flex shrink-0 items-center text-[#333333] font-medium gap-2 hover:opacity-80"
        >
          <FiArrowLeft size={20} />
          <span>Return to flashcards</span>
        </Link>
      </div>

      {error && <p className="text-red-500 font-medium">{error}</p>}

      {cards && !error && !card && (
        <p className="text-[#878787] font-medium text-center py-16">
          No cards in this deck
        </p>
      )}

      {card && (
        <div className="max-w-3xl mx-auto">
          <Flashcard
            // a new card starts on its front, without the flip animation
            key={card.id}
            term={card.term || ""}
            definition={card.definition || ""}
            flipped={flipped}
            onFlip={() => setFlipped(!flipped)}
          />

          <div className="relative flex items-center justify-center gap-6 mt-8">
            <button
              aria-label="Previous card"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className={roundButtonClassName}
            >
              <FiArrowLeft size={20} />
            </button>
            <span className="text-default font-medium min-w-20 text-center">
              {current + 1} / {total}
            </span>
            <button
              aria-label="Next card"
              onClick={() => goTo(current + 1)}
              disabled={current === total - 1}
              className={roundButtonClassName}
            >
              <FiArrowRight size={20} />
            </button>
            <button
              aria-label="Shuffle"
              title="Shuffle"
              onClick={shuffle}
              className={`${roundButtonClassName} absolute right-0`}
            >
              <FiShuffle size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
