export default function Flashcard({
  flashcardName,
  flashcardTotal,
}: {
  flashcardName: string;
  flashcardTotal: string | number;
}) {
  return (
    <div>
      <div>{flashcardName} ({flashcardTotal} cards)</div>
    </div>
  );
}
