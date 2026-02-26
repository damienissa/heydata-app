import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DatabaseIcon,
  BrainCircuitIcon,
  BarChart3Icon,
  ShieldCheckIcon,
  MessageSquareTextIcon,
  ZapIcon,
} from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Nav */}
      <nav className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500">
            <span className="text-sm font-bold text-white">H</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">heydata</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/auth/signup">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              Your data has answers.
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                Just ask.
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              Conversational analytics for PostgreSQL. Ask questions in plain
              English, get instant charts and insights — no SQL, no dashboards,
              no waiting.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/auth/signup">Get Started Free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Demo preview */}
        <div className="mx-auto mt-16 w-full max-w-2xl">
          <div className="rounded-xl border border-border bg-muted/50 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500">
                <MessageSquareTextIcon className="h-4 w-4 text-white" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  &quot;What were our top 10 products by revenue last
                  quarter?&quot;
                </p>
                <div className="flex gap-1.5">
                  {[40, 65, 55, 80, 45, 70, 90, 50, 60, 75].map((h, i) => (
                    <div
                      key={i}
                      className="w-6 rounded-sm bg-gradient-to-t from-orange-400 to-amber-400"
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Revenue grew 23% QoQ with Electronics leading at $2.4M,
                  followed by Home &amp; Garden at $1.8M...
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight">
            Everything you need to unlock your data
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<BrainCircuitIcon className="h-5 w-5" />}
              title="9-Agent AI Pipeline"
              description="Nine specialized Claude agents work in sequence — parsing intent, generating SQL, validating results, and creating visualizations."
            />
            <Feature
              icon={<DatabaseIcon className="h-5 w-5" />}
              title="Semantic Layer"
              description="Auto-generated from your schema. Maps tables and columns to business concepts so the AI understands your data."
            />
            <Feature
              icon={<BarChart3Icon className="h-5 w-5" />}
              title="16 Chart Types"
              description="From bar charts to heatmaps, waterfall charts, gauges, and dual-axis views. Every response includes a narrative summary."
            />
            <Feature
              icon={<ZapIcon className="h-5 w-5" />}
              title="Slash Commands"
              description="Auto-generated shortcuts for common queries. Type / and pick from your most-used analytics in one click."
            />
            <Feature
              icon={<ShieldCheckIcon className="h-5 w-5" />}
              title="Security Built-In"
              description="AES-256-GCM encryption, read-only SQL guards, row-level security, and server-side API keys. Your data stays safe."
            />
            <Feature
              icon={<MessageSquareTextIcon className="h-5 w-5" />}
              title="Chat History"
              description="Every conversation is saved. Pick up where you left off, revisit past insights, or start fresh anytime."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-16 text-center">
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">
          Ready to talk to your data?
        </h2>
        <p className="mb-6 text-muted-foreground">
          Connect your PostgreSQL database and start asking questions in minutes.
        </p>
        <Button size="lg" asChild>
          <Link href="/auth/signup">Get Started Free</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        heydata — AI-powered analytics for your database
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400/10 to-amber-500/10 text-orange-500">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
