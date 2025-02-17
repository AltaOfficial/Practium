"use client"
import { getFlashcards } from "./actions"
import { useEffect, useState } from "react"

interface Flashcard {
  id: number
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
            
        </div>
    </div>
  )
}
