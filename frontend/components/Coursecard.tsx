import { Database } from "@/utils/supabase/database.types";
import { FaRegClock } from "react-icons/fa";


type Course = Database["public"]["Tables"]["courses"]["Row"];

type CourseCardProps = {
  courseName: string;
  testsGenerated: number;
  lastAccessed: string;
  href: string;
}

export default function CourseCard({
  courseName,
  testsGenerated,
  lastAccessed,
  href
}: CourseCardProps) {
  return (
    <a href={href} className="block">
      <div className="bg-white p-4 rounded-xl transition-transform hover:-translate-y-1 shadow-[5px_5px_0_0px_rgba(51,51,51,1)] h-[145px] flex flex-col">
        <h3 className="text-xl font-semibold text-default mb-6 truncate">
          {courseName}
        </h3>
        <div className="flex items-center justify-between text-sm text-gray-500 gap-4 mt-auto">
          <div className="flex font-medium items-center gap-1.5 ">
            <span>{testsGenerated} tests generated</span>
          </div>
          <div className="flex font-medium items-center gap-1.5">
            <FaRegClock />
            <span>Last accessed {lastAccessed}</span>
          </div>
        </div>
      </div>
    </a>
  );
}