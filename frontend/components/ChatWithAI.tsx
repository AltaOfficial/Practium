import { Button, TextField } from "@radix-ui/themes";
import { useState, Dispatch, SetStateAction, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

// The chat is stored as one string; user messages are wrapped in these
// markers and everything outside them is assistant output.
export const USER_START = "\u0001";
export const USER_END = "\u0002";
// starts a new assistant message when the assistant was already the last to speak
export const ASSISTANT_BREAK = "\u0003";

// Stream chunks are JSON-encoded strings. Fall back to the raw text if the
// backend is still sending the old unencoded format.
export function parseStreamChunk(data: string): string {
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === "string" ? parsed : data;
  } catch {
    return data;
  }
}

type ChatMessage ={ role: "user" | "assistant"; content: string };

function parseChat(chat: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  chat.split(USER_START).forEach((part, i) => {
    let assistantText = part;
    if (i > 0) {
      const end = part.indexOf(USER_END);
      const userText = end === -1 ? part : part.slice(0, end);
      assistantText = end === -1 ? "" : part.slice(end + USER_END.length);
      if (userText.trim()) messages.push({ role: "user", content: userText });
    }
    for (const text of assistantText.split(ASSISTANT_BREAK)) {
      if (text.trim()) {
        messages.push({ role: "assistant", content: text.trim() });
      }
    }
  });
  return messages;
}

// Normalise LaTeX delimiters for remark-math: \( \) -> $ $, and \[ \] / $$ $$
// -> display math on its own lines.
// The markdown math parser ends a formula at an escaped dollar sign (\$), so
// escaped dollars inside math are rewritten to a KaTeX command without "$".
function formatMath(text: string) {
  const escapeDollars = (math: string) =>
    math.replace(/\\\$/g, "\\text{\\textdollar}");
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math + "$$")
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math.trim() + "$")
    .replace(
      // escaped dollar outside math | $$display$$ | $inline$
      /\\\$|\$\$((?:\\[\s\S]|[^\\])*?)\$\$|\$((?:\\[\s\S]|[^$\\\n])+)\$/g,
      (match, display, inline) => {
        if (display !== undefined) {
          return "\n\n$$\n" + escapeDollars(display.trim()) + "\n$$\n\n";
        }
        if (inline !== undefined) return "$" + escapeDollars(inline) + "$";
        return match;
      }
    );
}

export default function ChatWithAI({
  currentQuestionChat,
  setCurrentQuestionChat,
  questionContext,
}: {
  currentQuestionChat: string;
  setCurrentQuestionChat: Dispatch<SetStateAction<string>>;
  // the question the student is on and their answers, sent along with each message
  questionContext?: string;
}) {
  const [messageInput, setMessageInput] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  };

  // Scroll to bottom when chat content changes
  useEffect(() => {
    scrollToBottom();
  }, [currentQuestionChat]);

  const chatMessages = parseChat(currentQuestionChat);

  const sendMessage = () => {
    const text = messageInput.trim();
    if (!text) return;

    // Add user message to the chat immediately
    setCurrentQuestionChat((prev) => prev + USER_START + text + USER_END);

    // Send the prior conversation with the correct roles, plus the new message
    const messages = [...chatMessages, { role: "user", content: text }];

    const eventStream = new EventSource(
      `${process.env.NODE_ENV == "production" ? process.env.NEXT_PUBLIC_BACKEND_URL : "http://localhost:8000"}/ask?messages=${encodeURIComponent(
        JSON.stringify(messages)
      )}&context=${encodeURIComponent(questionContext || "")}`
    );

    eventStream.onmessage = (e) => {
      if (e.data === "[DONE]") {
        eventStream.close();
        return;
      }
      // Chunks are JSON-encoded so newlines survive the event stream
      const chunk = parseStreamChunk(e.data);
      setCurrentQuestionChat((prev) => prev + chunk);
    };
    eventStream.onerror = (e) => {
      console.error(e);
      eventStream.close();
    };

    // Clear input after sending
    setMessageInput("");
  };

  return (
    <div className="p-3 bg-white rounded-lg flex flex-col gap-5">
      <div className="h-8 flex flex-row-reverse justify-between place-items-center">
        <div className="flex flex-row-reverse gap-4">
          <button
            onClick={() => setCurrentQuestionChat("")}
            className="!bg-transparent flex items-center outline-none px-3 py-1.5 !border-2 !border-[#333333] text-[#333333] text-sm rounded-[4px] font-medium"
          >
            Restart Chat
          </button>
        </div>
      </div>
      <div className="bg-white h-[79vh] text-black flex flex-col rounded-lg items-end p-3 relative">
        <div className="flex-1 w-full overflow-y-auto" ref={chatContainerRef}>
          <div className="w-full flex flex-col gap-4 pr-1">
            {chatMessages.map((message, i) =>
              message.role === "user" ? (
                <div
                  key={i}
                  className="self-end max-w-[80%] bg-[#333333] text-white rounded-lg px-4 py-2 whitespace-pre-wrap break-words"
                >
                  {message.content}
                </div>
              ) : (
                <div
                  key={i}
                  className="self-start w-full bg-gray-100 rounded-lg px-4 py-3 leading-relaxed overflow-x-auto"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1">{children}</ol>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      hr: () => <hr className="my-4 border-t border-gray-300" />,
                      table: ({ children }) => (
                        <div className="my-3 overflow-x-auto">
                          <table className="border-collapse text-sm">{children}</table>
                        </div>
                      ),
                      th: ({ children, style }) => (
                        <th style={style} className="border border-gray-300 bg-gray-200 px-3 py-1.5 font-semibold">{children}</th>
                      ),
                      td: ({ children, style }) => (
                        <td style={style} className="border border-gray-300 px-3 py-1.5">{children}</td>
                      ),
                      h1: ({ children }) => <h1 className="text-xl font-semibold mt-5 mb-3 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-3 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-sm font-semibold mt-3 mb-2 first:mt-0">{children}</h4>,
                      h5: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h5>,
                      h6: ({ children }) => <h6 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h6>,
                    }}
                  >
                    {formatMath(message.content)}
                  </ReactMarkdown>
                </div>
              )
            )}
          </div>
        </div>
        <div className="flex w-full place-self-end mt-4">
          <TextField.Root
            onKeyDownCapture={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            size={"3"}
            className="w-full self-center flex border !text-[#333333] !outline-none !bg-transparent !font-medium border-[#333333] !rounded-[4px] !shadow-[1.5px_3px_0_0px_rgba(51,51,51,1)]"
          >
            <TextField.Slot className="!bg-transparent !text-[#333333] !font-medium" side="right">
              <Button className="!bg-[#333333] !text-white" onClick={sendMessage}>Send</Button>
            </TextField.Slot>
          </TextField.Root>
        </div>
      </div>
    </div>
  );
}
