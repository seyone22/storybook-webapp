import { db } from "@/db";
import { stories } from "@/db/schema";
import { desc } from "drizzle-orm";
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
      .orderBy(desc(stories.createdAt));
  } catch (err) {
    console.error("Failed to query stories:", err);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="max-w-4xl w-full space-y-12">
        
        {/* Header Block */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-500 animate-pulse">
            Storybook
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl font-light max-w-2xl mx-auto">
            An interactive, multi-agent narrative roleplay engine. Experience living worlds where characters act independently, hold private agendas, and scheme in secret.
          </p>
        </div>

        {/* Client Components for prompt submission and list */}
        <DashboardClient initialStories={activeStories} />

      </div>
    </main>
  );
}
