"use client"
import { getFlashcards } from "./actions"
import { useEffect, useState } from "react"
import Flashcard from "@/components/Flashcard"

interface Flashcard {
  id: Number
  name: string,
  totalCards: Number
}

export default function page() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);

  useEffect(() => {
    getFlashcards()
    .then((flashcards) => {
      if(flashcards != undefined){
        return setFlashcards([...flashcards]);
      }
    });
  }, []);

  return (
    <div>
        <div className="text-3xl">Flashcards</div>
        <div>
          {flashcards.map((flashcard, index) => <Flashcard flashcardTotal={flashcard.totalCards} flashcardName={flashcard.name}/>)}
        </div>
    </div>
  )
}
