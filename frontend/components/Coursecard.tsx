import { Card } from "@radix-ui/themes";
import Link from "next/link";
import { Database } from "@/utils/supabase/database.types";

type Course = Database["public"]["Tables"]["courses"]["Row"];

export default function AssessementCard({
  course,
  isGenerateCard = false,
}: {
  course?: Course;
  isGenerateCard?: boolean;
}) {
  return (
    <div>
      <Link
        href={
          isGenerateCard
            ? `/dashboard/practice/new`
            : `/dashboard/practice/courses/${course?.id}/`
        }
      >
        <Card
          className={
            "h-32 grid" + (isGenerateCard ? " place-content-center" : "")
          }
        >
          <p className="">{course?.name}</p>
          <p className="text-gray-400 text-xs">{course?.name}</p>
          {isGenerateCard && "+ Generate Assessment"}
        </Card>
      </Link>
    </div>
  );
}
