"use server";
import { supabase } from "@/utils/supabase/server";
import { Database } from "@/utils/supabase/database.types";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

// a deck of flashcards, and one card in it
export type Deck = Database["public"]["Tables"]["flashcards"]["Row"];
export type Card = Database["public"]["Tables"]["flashcard"]["Row"];

// how many decks the signed-in user has in each course: { [course id]: number of decks }
export async function getDeckCounts(): Promise<Record<number, number>> {
  const { userId } = await auth();
  if (!userId) return {};
  const { data } = await supabase
    .from("flashcards")
    .select("course_id")
    .eq("user_id", userId);
  const counts: Record<number, number> = {};
  for (const deck of data || []) {
    if (deck.course_id != null) {
      counts[deck.course_id] = (counts[deck.course_id] || 0) + 1;
    }
  }
  return counts;
}

// the decks of the signed-in user in a course, newest first
export async function getDecks(
  courseId: number
): Promise<{ data?: Deck[]; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "User not logged in" };
  if (Number.isNaN(courseId)) return { error: "Course not found" };
  const { data, error } = await supabase
    .from("flashcards")
    .select()
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    console.error(error);
    return { error: "Could not load your flashcards" };
  }
  return { data };
}

// one of the signed-in user's decks, with its cards in order
export async function getDeck(
  deckId: number
): Promise<{ data?: { deck: Deck; cards: Card[] }; error?: string }> {
  const { userId } = await auth();
  if (!userId || Number.isNaN(deckId)) return { error: "Flashcards not found" };
  const { data: decks } = await supabase
    .from("flashcards")
    .select()
    .eq("id", deckId)
    .eq("user_id", userId);
  const deck = decks?.[0];
  if (!deck) return { error: "Flashcards not found" };

  const { data: cards, error } = await supabase
    .from("flashcard")
    .select()
    .eq("deck_id", deck.id)
    .order("position", { ascending: true });
  if (error || !cards) {
    console.error(error);
    return { error: "Could not load the cards" };
  }
  return { data: { deck, cards } };
}

export async function deleteDeck(deckId: number) {
  const { userId } = await auth();
  if (!userId) return { error: "User not logged in" };
  // the cards are deleted with their deck
  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", deckId)
    .eq("user_id", userId);
  return error ? { error: "Could not delete the flashcards" } : { data: deckId };
}

// The backend writes the cards and saves the deck. formData holds "courseId", "content",
// "uploadedFiles" and "numOfCards" (a number or "auto"). Returns the id of the new deck.
export async function generateFlashcards(
  formData: FormData
): Promise<{ data?: number; error?: string }> {
  const cookieStore = await cookies();
  const { getToken } = await auth();
  const token = await getToken();

  try {
    const response = await fetch(
      `${
        process.env.VERCEL_ENV == "production"
          ? process.env.NEXT_PUBLIC_BACKEND_URL
          : "http://backend:8000"
      }/generateflashcards`,
      {
        method: "POST",
        body: formData,
        headers: {
          Cookie: cookieStore.toString(),
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const result = await response.json();
    if (!response.ok || !result.deck_id) {
      return { error: result.error || "Could not generate flashcards" };
    }
    return { data: result.deck_id };
  } catch (error) {
    console.error(error);
    return { error: "Could not generate flashcards" };
  }
}
