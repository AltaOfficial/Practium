import { Card } from "@radix-ui/themes";
import Link from "next/link";
import { Database } from "@/utils/supabase/database.types";
import { useParams } from "next/navigation";

type Assessment = Database["public"]["Tables"]["assessments"]["Row"];

export default function AssessementCard({
  assessment,
  isGenerateCard = false,
}: {
  assessment?: Assessment;
  isGenerateCard?: boolean;
}) {
  const params = useParams();

  return (
    <div>
      <Link
        href={
          isGenerateCard
            ? `/dashboard/practice/courses/${params.course_id}/generate`
            : `/dashboard/practice/courses/${params.course_id}/assessments/${assessment?.id}`
        }
      >
        <Card
          className={
            "h-32 grid" + (isGenerateCard ? " place-content-center" : "")
          }
        >
          <p className="">{assessment?.name}</p>
          <p className="text-gray-400 text-xs">{assessment?.name}</p>
          {isGenerateCard && "+ Generate Assessment"}
        </Card>
      </Link>
    </div>
  );
}
