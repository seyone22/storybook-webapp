import { db } from "@/db";
import { stories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Query all active stories in database
  let activeStories: any[] = [];
  try {
    activeStories = await db
      .select({
        id: stories.id,
        title: stories.title,
        description: stories.description,
        createdAt: stories.createdAt,
      })
      .from(stories)
      .where(eq(stories.isTemplate, false))
      .orderBy(desc(stories.createdAt));
  } catch (err) {
    console.error("Failed to query stories:", err);
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="max-w-4xl w-full space-y-10">
        
        {/* Header Block */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-primary font-serif">
            Storybook
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto font-sans leading-relaxed">
            An interactive, multi-agent narrative roleplay engine. Experience living worlds where characters act independently, hold private agendas, and scheme in secret.
          </p>
        </div>

        {/* Client Components for prompt submission and list */}
        <DashboardClient initialStories={activeStories} />

      </div>
    </main>
  );
}
