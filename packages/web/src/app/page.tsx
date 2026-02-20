"use client";

import { Assistant } from "./assistant";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useState } from "react";

export default function Home() {
  const [conversations] = useState<{ id: string; title: string }[]>([]);
  const [activeId, setActiveId] = useState<string>();

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNewChat={() => {}}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Assistant />
        </main>
      </div>
    </div>
  );
}
