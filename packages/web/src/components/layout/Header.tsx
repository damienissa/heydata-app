"use client";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500">
          <span className="text-sm font-bold text-white">H</span>
        </div>
        <span className="text-lg font-semibold tracking-tight">heydata</span>
      </div>
    </header>
  );
}
