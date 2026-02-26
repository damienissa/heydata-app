import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 px-4 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">heydata</h1>
          <p className="text-lg text-muted-foreground">
            AI-powered analytics for your database
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/auth/login">Get Started</Link>
        </Button>
      </div>
    </div>
  );
}
