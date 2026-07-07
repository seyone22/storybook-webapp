"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import StoryFeed from "@/components/StoryFeed";
import AsciiMap from "@/components/AsciiMap";
import CastPanel from "@/components/CastPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Send, Sparkles, AlertCircle, Compass, 
  MessageSquare, Users, Cpu, Clock, Terminal 
} from "lucide-react";

// Wrap the main logic in a Client Component that holds state
function StoryActiveContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation State
  const [logs, setLogs] = useState<any[]>([]);
  const [currentLocationName, setCurrentLocationName] = useState("");
  const [currentLocationDesc, setCurrentLocationDesc] = useState("");
  const [sensoryTags, setSensoryTags] = useState<string[]>([]);
  const [asciiMap, setAsciiMap] = useState("");
  const [cast, setCast] = useState<any[]>([]);
  const [roomItems, setRoomItems] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<any>({ name: "", bio: "", status: [] });
  const [directorLogs, setDirectorLogs] = useState<any[]>([]);

  // Input Toggles
  const [inputVal, setInputVal] = useState("");
  const [actionType, setActionType] = useState<"speech" | "action">("speech");
  const [submitting, setSubmitting] = useState(false);

  // Initialize/Load state
  useEffect(() => {
    if (!storyId) {
      setError("No story ID specified.");
      setLoading(false);
      return;
    }
    fetchState("wait");
  }, [storyId]);

  const fetchState = async (
    type: "speech" | "action" | "wait" | "move" | "undo" | "reroll" | "edit",
    payload?: any
  ) => {
    if (!storyId) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          actionType: type,
          text: payload?.text || "",
          direction: payload?.direction || "",
          memoryId: payload?.memoryId || "",
          newText: payload?.newText || "",
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLogs(data.logs);
        setCurrentLocationName(data.currentLocationName);
        setCurrentLocationDesc(data.currentLocationDesc);
        setSensoryTags(data.sensoryTags);
        setAsciiMap(data.asciiMap);
        setCast(data.cast);
        setRoomItems(data.roomItems);
        setInventory(data.inventory);
        setPlayerStats(data.playerStats);
        setDirectorLogs(data.directorLogs);
        setError(null);
      }
    } catch (err) {
      console.error(err);
      setError("Connection to server lost.");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleSend = () => {
    if (!inputVal.trim() || submitting) return;
    fetchState(actionType, { text: inputVal });
    setInputVal("");
  };

  const handleMove = (direction: string) => {
    if (submitting) return;
    fetchState("move", { direction });
  };

  const handleEdit = (id: string, newText: string) => {
    fetchState("edit", { memoryId: id, newText });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <Cpu className="w-10 h-10 animate-spin text-violet-400" />
        <span className="text-sm font-medium animate-pulse">Initializing story state...</span>
      </div>
    );
  }

  if (error && !currentLocationName) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-6 space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <span className="text-md font-bold text-slate-200">Error Loading Story</span>
        <p className="text-xs text-slate-500 text-center max-w-sm">{error}</p>
        <Button variant="outline" className="border-slate-800" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      
      {/* 1. Header Area */}
      <header className="flex justify-between items-center border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => router.push("/")}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-900 h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-sm sm:text-md font-bold text-slate-200">
              {currentLocationName || "Story Chambers"}
            </h1>
            <p className="text-[10px] text-slate-500 font-mono hidden sm:block">
              Coordinates: {sensoryTags.join(", ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Collapsible Director Console (Desktop Drawer) */}
          <Sheet>
            <SheetTrigger className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md text-slate-400 hover:text-violet-400 hover:bg-slate-900 transition-colors cursor-pointer border border-transparent hover:border-slate-800">
              <Terminal className="w-4 h-4" />
              <span className="hidden sm:inline">GM Console</span>
            </SheetTrigger>
            <SheetContent side="right" className="bg-slate-950 border-slate-900 text-slate-100 max-w-[420px] w-full p-4 flex flex-col">
              <SheetHeader className="pb-3 border-b border-slate-900">
                <SheetTitle className="text-violet-400 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Under the Hood Console
                </SheetTitle>
                <SheetDescription className="text-slate-500">
                  Track character private logs and GM thoughts in real-time.
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 mt-4">
                <div className="space-y-4">
                  {directorLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg bg-slate-900/60 border border-slate-900 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-[10px] font-bold text-violet-400">
                        <span>{log.charName} (Thoughts)</span>
                        <span className="text-slate-600 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-350 leading-relaxed italic">{log.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* 2. Room Description Panel (Sensory description) */}
      <div className="bg-slate-950/20 px-4 py-3 border-b border-slate-900 shrink-0 text-center">
        <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mx-auto italic font-serif">
          "{currentLocationDesc}"
        </p>
      </div>

      {/* 3. Main Workspace Layout */}
      {/* Desktop Layout */}
      <div className="flex-1 hidden md:grid grid-cols-12 gap-4 p-4 overflow-hidden h-[calc(100vh-130px)]">
        {/* Left Side: Map & Inventory */}
        <div className="col-span-3 h-full overflow-hidden flex flex-col">
          <AsciiMap asciiMap={asciiMap} onMove={handleMove} />
        </div>

        {/* Center: Feed & Input */}
        <div className="col-span-6 h-full flex flex-col space-y-4 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <StoryFeed 
              logs={logs} 
              onEdit={handleEdit} 
              onUndo={() => fetchState("undo")} 
              onReroll={() => fetchState("reroll")} 
            />
          </div>

          {/* Action Input Block */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex justify-between items-center bg-slate-950/40 border border-slate-900 rounded-lg p-1 max-w-[280px] w-full self-start">
              <Button
                size="sm"
                variant={actionType === "speech" ? "default" : "ghost"}
                onClick={() => setActionType("speech")}
                className={`text-[10px] h-7 w-28 uppercase ${actionType === "speech" ? "bg-violet-600 hover:bg-violet-500" : "text-slate-500"}`}
              >
                Speech
              </Button>
              <Button
                size="sm"
                variant={actionType === "action" ? "default" : "ghost"}
                onClick={() => setActionType("action")}
                className={`text-[10px] h-7 w-28 uppercase ${actionType === "action" ? "bg-violet-600 hover:bg-violet-500" : "text-slate-500"}`}
              >
                Propose Action
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={
                  actionType === "speech"
                    ? "Say something to the room..."
                    : "Describe what you attempt to do (e.g. Try to unlock chest)..."
                }
                className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600 focus-visible:ring-violet-500 h-10 flex-1"
                disabled={submitting}
              />
              <Button 
                onClick={handleSend}
                disabled={!inputVal.trim() || submitting}
                className="bg-violet-600 hover:bg-violet-500 shadow-md h-10 w-10 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => fetchState("wait")}
                disabled={submitting}
                className="border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 h-10 text-xs px-3 gap-1 shrink-0"
                title="Observe what characters do next without reacting yourself"
              >
                <Clock className="w-3.5 h-3.5" />
                Pass Turn
              </Button>
            </div>
          </div>
        </div>

        {/* Right Side: Cast Sheet */}
        <div className="col-span-3 h-full overflow-hidden flex flex-col">
          <CastPanel 
            cast={cast} 
            roomItems={roomItems} 
            inventory={inventory} 
            playerStats={playerStats} 
          />
        </div>
      </div>

      {/* Mobile Layout (Tabbed Viewport) */}
      <div className="flex-1 md:hidden flex flex-col overflow-hidden h-[calc(100vh-130px)]">
        <Tabs defaultValue="story" className="flex-1 flex flex-col overflow-hidden">
          
          {/* Scrollable contents panel */}
          <div className="flex-1 overflow-hidden p-3">
            <TabsContent value="story" className="h-full m-0 flex flex-col space-y-3 overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <StoryFeed 
                  logs={logs} 
                  onEdit={handleEdit} 
                  onUndo={() => fetchState("undo")} 
                  onReroll={() => fetchState("reroll")} 
                />
              </div>

              {/* Input block */}
              <div className="flex flex-col gap-2 shrink-0">
                <div className="flex justify-between items-center bg-slate-950/40 border border-slate-900 rounded-lg p-1 max-w-[200px] w-full self-start">
                  <Button
                    size="sm"
                    variant={actionType === "speech" ? "default" : "ghost"}
                    onClick={() => setActionType("speech")}
                    className={`text-[9px] h-6 px-3 uppercase ${actionType === "speech" ? "bg-violet-600 hover:bg-violet-500" : "text-slate-500"}`}
                  >
                    Speech
                  </Button>
                  <Button
                    size="sm"
                    variant={actionType === "action" ? "default" : "ghost"}
                    onClick={() => setActionType("action")}
                    className={`text-[9px] h-6 px-3 uppercase ${actionType === "action" ? "bg-violet-600 hover:bg-violet-500" : "text-slate-500"}`}
                  >
                    Action
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder={
                      actionType === "speech" ? "Speak..." : "Attempt..."
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600 focus-visible:ring-violet-500 h-9 flex-1"
                    disabled={submitting}
                  />
                  <Button 
                    onClick={handleSend}
                    disabled={!inputVal.trim() || submitting}
                    className="bg-violet-600 hover:bg-violet-500 h-9 w-9 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    onClick={() => fetchState("wait")}
                    disabled={submitting}
                    className="border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 h-9 px-2.5 shrink-0"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="map" className="h-full m-0 overflow-hidden">
              <AsciiMap asciiMap={asciiMap} onMove={handleMove} />
            </TabsContent>

            <TabsContent value="cast" className="h-full m-0 overflow-hidden">
              <CastPanel 
                cast={cast} 
                roomItems={roomItems} 
                inventory={inventory} 
                playerStats={playerStats} 
              />
            </TabsContent>

            <TabsContent value="console" className="h-full m-0 overflow-hidden flex flex-col bg-slate-900/40 border border-slate-800 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-violet-400" />
                Director Console Logs
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  {directorLogs.length === 0 ? (
                    <span className="text-xs text-slate-600 italic block py-4 text-center">No logs generated yet.</span>
                  ) : (
                    directorLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-900 space-y-1 text-xs">
                        <div className="flex justify-between items-center text-[10px] font-bold text-violet-400">
                          <span>{log.charName} (Thoughts)</span>
                          <span className="text-slate-600 font-mono">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-slate-350 leading-relaxed italic">{log.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>

          {/* Sticky Bottom Tab bar (Mobile only) */}
          <TabsList className="bg-slate-950 border-t border-slate-900 w-full rounded-none h-14 grid grid-cols-4 shrink-0 p-1">
            <TabsTrigger value="story" className="flex flex-col items-center justify-center gap-0.5 text-slate-500 data-[state=active]:text-violet-400 data-[state=active]:bg-transparent">
              <MessageSquare className="w-4.5 h-4.5" />
              <span className="text-[9px] uppercase tracking-wide">Story</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="flex flex-col items-center justify-center gap-0.5 text-slate-500 data-[state=active]:text-violet-400 data-[state=active]:bg-transparent">
              <Compass className="w-4.5 h-4.5" />
              <span className="text-[9px] uppercase tracking-wide">Map</span>
            </TabsTrigger>
            <TabsTrigger value="cast" className="flex flex-col items-center justify-center gap-0.5 text-slate-500 data-[state=active]:text-violet-400 data-[state=active]:bg-transparent">
              <Users className="w-4.5 h-4.5" />
              <span className="text-[9px] uppercase tracking-wide">Cast</span>
            </TabsTrigger>
            <TabsTrigger value="console" className="flex flex-col items-center justify-center gap-0.5 text-slate-500 data-[state=active]:text-violet-400 data-[state=active]:bg-transparent">
              <Terminal className="w-4.5 h-4.5" />
              <span className="text-[9px] uppercase tracking-wide">GM Log</span>
            </TabsTrigger>
          </TabsList>

        </Tabs>
      </div>

    </div>
  );
}

// Next.js SearchParams requires Suspense wrapper when building static bundles
export default function StoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <Cpu className="w-10 h-10 animate-spin text-violet-400" />
        <span className="text-sm font-medium animate-pulse">Entering storybooks...</span>
      </div>
    }>
      <StoryActiveContainer />
    </Suspense>
  );
}
