"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Calendar, BookOpen, UserPlus, Loader2 } from "lucide-react";

interface StoryItem {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
}

interface DashboardClientProps {
  initialStories: StoryItem[];
}

export default function DashboardClient({ initialStories }: DashboardClientProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = [
    "Contacting Gemini 3.5 Flash...",
    "Drafting historical lore & magic guidelines...",
    "Spawning independent NPC personalities...",
    "Calculating private character agendas & secrets...",
    "Mapping interconnected coordinates...",
    "Compiling starting ASCII maps...",
    "Saving world database entities...",
    "Entering story chambers..."
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setLoadingStep(0);

    // Dynamic fake stepper interval for better user experience
    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 2800);

    try {
      const res = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      clearInterval(interval);

      if (data.error) {
        alert("Error generating world: " + data.error);
        setIsLoading(false);
      } else {
        router.push(`/story?id=${data.storyId}`);
      }
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      alert("Failed to initialize world. Check terminal console.");
      setIsLoading(false);
    }
  };

  const autofillPreset = () => {
    setPrompt(
      "I want to play as the fourth noble son of the Rosenthaal family. I am frail and weak, having contracted the 'white death' soon after birth. I live in my own manor on the outskirts of the kingdom. My family is in the capital and sends me money and regard but ignores me otherwise. This world has magic. Primary characters: Alice my maid, she is blonde, soft-spoken, but acting suspiciously lately."
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      
      {/* Creation Pane */}
      <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 space-y-6 z-50 animate-in fade-in zoom-in duration-300">
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
            <div className="space-y-2 text-center">
              <h3 className="text-xl font-semibold text-slate-100">Creating World</h3>
              <p className="text-sm text-slate-400 animate-pulse">{steps[loadingStep]}</p>
            </div>
            <div className="w-48 bg-slate-800 h-1 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full transition-all duration-1000"
                style={{ width: `${((loadingStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Draft a New Scenario
          </CardTitle>
          <CardDescription>
            Type a few sentences describing who you are, the setting, and initial characters. The GM will populate the rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., I am a rogue street urchin in a steampunk city. I have a mechanical pocket watch. My rival is Marcus, a wealthy noble thief who is plotting to betray me..."
            className="min-h-[160px] bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-500 focus-visible:ring-violet-500"
          />
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Powered by Gemini 3.5 Flash</span>
            <Button
              variant="link"
              onClick={autofillPreset}
              className="text-violet-400 hover:text-violet-300 p-0 h-auto text-xs"
            >
              Autofill Rosenthaal Manor Preset
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-slate-55 shadow-lg"
          >
            Create World & Begin
          </Button>
        </CardFooter>
      </Card>

      {/* History Pane */}
      <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md shadow-2xl h-[440px] flex flex-col">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-fuchsia-400" />
            Resume Chronicles
          </CardTitle>
          <CardDescription>Select a previously created story world to return to your scene.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            {initialStories.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No active chronicles found. Create your first world above!
              </div>
            ) : (
              <div className="space-y-3">
                {initialStories.map((story) => (
                  <div
                    key={story.id}
                    onClick={() => router.push(`/story?id=${story.id}`)}
                    className="p-4 rounded-lg bg-slate-950/60 border border-slate-900 hover:border-violet-500/50 hover:bg-slate-950 transition-all cursor-pointer group flex items-start justify-between"
                  >
                    <div className="space-y-1 pr-4">
                      <h4 className="font-semibold text-slate-200 group-hover:text-violet-400 transition-colors">
                        {story.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 pr-2">
                        {story.description || "No description provided."}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 text-[10px] text-slate-600">
                      <Calendar className="w-3.5 h-3.5 mb-1" />
                      {new Date(story.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
    </div>
  );
}
