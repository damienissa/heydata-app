"use client";

import { useEffect, useRef, useState } from "react";
import { type Command } from "@/hooks/use-commands";

interface CommandPickerProps {
  commands: Command[];
  query: string;
  onSelect: (command: Command) => void;
  onClose: () => void;
}

export function CommandPicker({ commands, query, onSelect, onClose }: CommandPickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = commands.filter((c) =>
    c.slashCommand.toLowerCase().startsWith(query.toLowerCase()),
  );

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Keyboard navigation — delegated from the parent Composer via onKeyDown
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        const cmd = filtered[activeIndex];
        if (cmd) {
          e.preventDefault();
          onSelect(cmd);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [filtered, activeIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border bg-popover shadow-lg">
      <div className="border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Commands</span>
      </div>
      <ul ref={listRef} className="max-h-60 overflow-y-auto p-1">
        {filtered.map((cmd, i) => (
          <li key={cmd.id}>
            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                // Prevent the input from losing focus
                e.preventDefault();
                onSelect(cmd);
              }}
            >
              <span className="shrink-0 font-mono text-sm font-medium text-foreground">
                /{cmd.slashCommand}
              </span>
              <span className="truncate text-sm text-muted-foreground">{cmd.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
