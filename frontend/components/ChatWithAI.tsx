import { Button, TextField } from "@radix-ui/themes";
import { useState, Dispatch, SetStateAction, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

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
      `${process.env.NODE_ENV == "production" ? process.env.NEXT_PUBLIC_BACKEND_URL : "http://localhost:8000"}/ask?messages=${encodeURIComponent(
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

  // Function to convert LaTeX delimiters to KaTeX format
  const convertMathDelimiters = (text: string) => {
    return text
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$')
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$');
  };

  // Function to replace "---" with markdown horizontal rule
  const replaceHorizontalRule = (text: string) => {
    return text.replace(/---/g, '\n---\n');
  };

  const convertNewlines = (text: string) => {
    // Replace single newlines not already part of a double newline
    return text.replace(/([^\n])\n([^\n])/g, '$1\n\n$2');
  };

  const fixMathDelimiters = (text: string) => {
    // 1. Ensure $$...$$ is on its own line (for block math)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, '\n$$$1$$\n');

    // 2. Convert \(...\) to $...$
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, '\$$1\$');

    // 3. Convert \[...\] to $$...$$
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n$$$1$$\n');

    // 4. Remove any double $$ at the start or end of a line (if not needed)
    text = text.replace(/([^\n])\$\$/g, '$1\n$$');
    text = text.replace(/\$\$([^\n])/g, '$$\n$1');

    return text;
  };

  const fixSingleCharLines = (text: string) => {
    // This regex matches blocks of 5+ lines where each line is 1-2 characters (including whitespace)
    return text.replace(/((?:^[^\S\r\n]*\S[^\S\r\n]*\r?\n){5,})/gm, (block) => {
      // Remove newlines and join the characters
      return block.replace(/\r?\n/g, '');
    });
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
          <div className="w-full">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
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
                  return <p>{children}</p>;
                },
                hr: () => <hr className="my-4 border-t border-gray-700" />,
                h1: ({ children }) => <h1 className="text-xl mt-6 mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg mt-5 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base mt-4 mb-2">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm mt-3 mb-2">{children}</h4>,
                h5: ({ children }) => <h5 className="text-xs mt-2 mb-1">{children}</h5>,
                h6: ({ children }) => <h6 className="text-xs mt-2 mb-1">{children}</h6>,
              }}
            >
              {replaceHorizontalRule(
                convertMathDelimiters(
                  fixMathDelimiters(
                    convertNewlines(
                      fixSingleCharLines(currentQuestionChat)
                    )
                  )
                )
              )}
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
