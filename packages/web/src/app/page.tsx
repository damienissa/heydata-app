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

  const bars = [40, 65, 55, 80, 45, 70, 90, 50, 60, 75];

  return (
    <div className="flex min-h-dvh flex-col bg-background overflow-x-hidden">
      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-4 py-24">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-glow-pulse absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-gradient-to-br from-orange-400/20 to-amber-500/10 blur-3xl" />
          <div className="animate-glow-pulse absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-gradient-to-br from-amber-400/15 to-orange-500/10 blur-3xl [animation-delay:2s]" />
          <div className="animate-glow-pulse absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-t from-orange-300/10 to-transparent blur-3xl [animation-delay:4s]" />
        </div>

        <div className="relative mx-auto max-w-3xl space-y-8 text-center">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-1.5 text-sm text-orange-700 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-amber-500/10 dark:text-orange-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
            </span>
            AI-powered analytics for PostgreSQL
          </div>

          <div className="space-y-5">
            <h1 className="animate-fade-up-delay-1 text-5xl font-bold tracking-tight sm:text-7xl">
              Your data has answers.
              <br />
              <span className="animate-shimmer bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                Just ask.
              </span>
            </h1>
            <p className="animate-fade-up-delay-2 mx-auto max-w-xl text-lg text-muted-foreground">
              Ask questions in plain English, get instant charts and insights.
              No SQL, no dashboards, no waiting.
            </p>
          </div>

          <div className="animate-fade-up-delay-3 flex items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:brightness-110"
              asChild
            >
              <Link href="/auth/signup">Get Started Free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Demo preview */}
        <div className="animate-fade-in-delay relative mx-auto mt-20 w-full max-w-2xl">
          <div className="animate-float-slow rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/50 p-6 shadow-2xl shadow-orange-500/5 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 shadow-md shadow-orange-500/20">
                <MessageSquareTextIcon className="h-4 w-4 text-white" />
              </div>
              <div className="space-y-3 flex-1">
                <p className="text-sm font-medium">
                  &quot;What were our top 10 products by revenue last
                  quarter?&quot;
                </p>
                <div className="flex items-end gap-1.5">
                  {bars.map((h, i) => (
                    <div
                      key={i}
                      className="animate-bar-grow flex-1 rounded-sm bg-gradient-to-t from-orange-500 to-amber-400"
                      style={{
                        height: `${h}px`,
                        animationDelay: `${0.8 + i * 0.08}s`,
                      }}
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
      <section className="relative border-t border-border px-4 py-24">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/40 via-transparent to-muted/20" />
        <div className="relative mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need to unlock your data
          </h2>
          <p className="mx-auto mb-14 max-w-lg text-center text-muted-foreground">
            A complete AI analytics stack — from natural language to
            interactive visualizations — in minutes.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      <section className="relative px-4 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-glow-pulse absolute left-1/2 top-1/2 h-64 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-400/10 to-amber-500/10 blur-3xl" />
        </div>
        <div className="relative">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to talk to your data?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Connect your PostgreSQL database and start asking questions in
            minutes.
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:brightness-110"
            asChild
          >
            <Link href="/auth/signup">Get Started Free</Link>
          </Button>
        </div>
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
    <div className="group rounded-xl border border-border/50 bg-gradient-to-b from-background to-muted/30 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-orange-200/50 hover:shadow-lg hover:shadow-orange-500/5 dark:hover:border-orange-500/20">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400/15 to-amber-500/15 text-orange-500 transition-colors group-hover:from-orange-400/25 group-hover:to-amber-500/25">
        {icon}
      </div>
      <h3 className="mb-1 font-medium">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
