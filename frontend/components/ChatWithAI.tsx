import { Button, DropdownMenu, TextField, HoverCard } from "@radix-ui/themes";
import { useState } from "react";

export default function ChatWithAI() {
  const [messageInput, setMessageInput] = useState("");

  const sendMessage = () => {
    if (!messageInput.trim()) return;
  };

  return (
    <div className="p-3 bg-stone-800 h-screen rounded-lg flex flex-col gap-5">
      <div className="h-8 flex flex-row-reverse justify-between place-items-center">
        <div className="flex flex-row-reverse gap-4">
          <Button>Restart Chat</Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button disabled>
                Choose Model (ChatGPT 4o-mini) <DropdownMenu.TriggerIcon />
              </Button>
            </DropdownMenu.Trigger>
          </DropdownMenu.Root>
        </div>

        <div>
          <p className="text-3xl">ChatGPT</p>
        </div>
      </div>
      <div className="bg-stone-900 h-screen flex flex-col-reverse rounded-lg items-end p-3">
        <div className="flex w-full place-self-end">
          <TextField.Root className="w-full self-center flex ">
            <TextField.Slot side="right">
              <Button onClick={sendMessage}>Send</Button>
            </TextField.Slot>
          </TextField.Root>
        </div>
        <div>jjjjj</div>
      </div>
    </div>
  );
}
