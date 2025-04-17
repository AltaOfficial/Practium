import { Button, DropdownMenu, TextField, HoverCard } from "@radix-ui/themes";
import { useState, Dispatch, SetStateAction, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { Components } from "react-markdown";

export default function ChatWithAI({
  currentQuestionChat,
  setCurrentQuestionChat,
}: {
  currentQuestionChat: string;
  setCurrentQuestionChat: Dispatch<SetStateAction<string>>;
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

  const sendMessage = () => {
    if (!messageInput.trim()) return;

    // Add user message to the chat immediately
    setCurrentQuestionChat((prev) => prev + `User: ${messageInput.trim()}\n\n`);

    // Create messages array from existing chat
    const messages = [];

    // Split existing chat by <br><br> to separate messages
    if (currentQuestionChat) {
      const chatParts = currentQuestionChat.split("<br><br>");

      chatParts.forEach((part) => {
        if (part.trim()) {
          messages.push({
            role: "user",
            content: part.trim(),
          });
        }
      });
    }

    messages.push({
      role: "user",
      content: `${messageInput.trim()}`,
    });

    const eventStream = new EventSource(
      `http://localhost:8000/ask?messages=${encodeURIComponent(
        JSON.stringify(messages)
      )}`
    );

    eventStream.onmessage = (e) => {
      if (e.data === "[DONE]") {
        eventStream.close();
        return;
      }
      setCurrentQuestionChat((prev) => prev + e.data);
    };
    eventStream.onerror = (e) => {
      console.error(e);
      eventStream.close();
    };

    // Clear input after sending
    setMessageInput("");
  };

  return (
    <div className="p-3 bg-stone-800 rounded-lg flex flex-col gap-5">
      <div className="h-8 flex flex-row-reverse justify-between place-items-center">
        <div className="flex flex-row-reverse gap-4">
          <Button
            onClick={() => setCurrentQuestionChat("")}
            className="hover:cursor-pointer"
          >
            Restart Chat
          </Button>
        </div>

        <div>
          <p className="text-3xl">ChatGPT</p>
        </div>
      </div>
      <div className="bg-stone-900 h-[79vh] flex flex-col rounded-lg items-end p-3 relative">
        <div className="flex-1 w-full overflow-y-auto" ref={chatContainerRef}>
          <div className="w-full">
            <ReactMarkdown
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({ children }) => {
                  const content = typeof children === "string" ? children : "";
                  if (
                    content.startsWith("User:") ||
                    content.startsWith("Assistant:")
                  ) {
                    return <div className="mt-4 mb-6">{children}</div>;
                  }
                  // Handle horizontal rules within paragraphs
                  if (content.includes("---")) {
                    const parts = content.split("---");
                    return (
                      <div>
                        {parts.map((part, index) => (
                          <div key={index}>
                            {index > 0 && (
                              <hr className="my-4 border-t border-gray-700" />
                            )}
                            <p>{part}</p>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return <p>{children}</p>;
                },
                hr: () => <hr className="my-4 border-t border-gray-700" />,
              }}
            >
              {currentQuestionChat}
            </ReactMarkdown>
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
            className="w-full self-center flex"
          >
            <TextField.Slot side="right">
              <Button onClick={sendMessage}>Send</Button>
            </TextField.Slot>
          </TextField.Root>
        </div>
      </div>
    </div>
  );
}
