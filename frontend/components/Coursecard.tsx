"use client";
import { FaRegClock } from "react-icons/fa";
import { FiMoreVertical } from "react-icons/fi";
import { DropdownMenu } from "@radix-ui/themes";

type CourseCardProps = {
  courseName: string;
  testsGenerated: number;
  lastAccessed: string;
  href: string;
  // what the number counts, when it is not tests (for example "decks")
  countLabel?: string;
  // opens the context of the class (notes, example material, memory)
  onContextClick?: () => void;
}

export default function CourseCard({
  courseName,
  testsGenerated,
  lastAccessed,
  href,
  countLabel = "tests generated",
  onContextClick
}: CourseCardProps) {
  return (
    <a href={href} className="block">
      <div className="bg-white p-4 rounded-xl transition-transform hover:-translate-y-1 shadow-[5px_5px_0_0px_rgba(51,51,51,1)] h-[145px] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-6">
          <h3 className="text-xl font-semibold text-default truncate">
            {courseName}
          </h3>
          {onContextClick && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button
                  aria-label={`Options for ${courseName}`}
                  // the card is a link to the course, the button is not
                  onClick={(e) => e.preventDefault()}
                  className="shrink-0 -mr-1 w-8 h-8 flex items-center justify-center !bg-transparent outline-none rounded-full text-[#333333] hover:!bg-gray-100 focus-visible:!bg-gray-100 transition-colors"
                >
                  <FiMoreVertical size={20} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                align="end"
                className="!bg-white !rounded-md !border-2 !border-[#333333] !shadow-[3px_3px_0_0px_rgba(51,51,51,1)]"
              >
                <DropdownMenu.Item
                  onSelect={onContextClick}
                  className="!text-[#333333] !font-medium !font-poppins !rounded-[4px] !cursor-pointer data-[highlighted]:!bg-[#333333] data-[highlighted]:!text-white"
                >
                  Class context
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 gap-4 mt-auto">
          <div className="flex font-medium items-center gap-1.5 ">
            <span>{testsGenerated} {countLabel}</span>
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