"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  Sparkles, 
  Calendar, 
  BookOpen, 
  User, 
  MapPin, 
  Compass, 
  Scroll, 
  Edit3, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Loader2 
} from "lucide-react";

interface StoryItem {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
}

interface DashboardClientProps {
  initialStories: StoryItem[];
}

// Structures matching the director's output
interface WorldLore {
  keyword: string;
  content: string;
}

interface WorldLocation {
  name: string;
  description: string;
  sensoryTags: string[];
  coordinates: { x: number; y: number };
  connections: Record<string, string>;
}

interface WorldNPC {
  name: string;
  publicBio: string;
  privateAgenda: string;
  dialogueStyle: string;
  startingLocationName: string;
}

interface WorldDraft {
  title: string;
  description: string;
  player: {
    name: string;
    age: number;
    looks: string;
    skills: string[];
    status: string[];
  };
  locations: WorldLocation[];
  characters: WorldNPC[];
  items: { name: string; description: string; startingLocationName: string }[];
  relationships: { sourceName: string; targetName: string; trust: number; hostility: number; suspicion: number }[];
  initialDirectorGoals: string[];
  lore: WorldLore[];
}

type StepType = "input" | "loading_draft" | "editor" | "character" | "loading_play";

export default function DashboardClient({ initialStories }: DashboardClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<StepType>("input");
  const [prompt, setPrompt] = useState("");
  const [loadingProgressStep, setLoadingProgressStep] = useState(0);
  const [draft, setDraft] = useState<WorldDraft | null>(null);

  // Character creator fields
  const [charName, setCharName] = useState("");
  const [charAge, setCharAge] = useState(16);
  const [charLooks, setCharLooks] = useState("");
  const [charSkills, setCharSkills] = useState<string[]>([]);
  const [newSkillText, setNewSkillText] = useState("");

  // Room editor state
  const [selectedLocIndex, setSelectedLocIndex] = useState<number | null>(null);
  const [locName, setLocName] = useState("");
  const [locDesc, setLocDesc] = useState("");
  const [locSensory, setLocSensory] = useState("");

  // NPC editor state
  const [selectedNpcIndex, setSelectedNpcIndex] = useState<number | null>(null);
  const [npcName, setNpcName] = useState("");
  const [npcBio, setNpcBio] = useState("");
  const [npcAgenda, setNpcAgenda] = useState("");
  const [npcDialogue, setNpcDialogue] = useState("");

  const loadingSteps = [
    "Contacting Gemini 3.5 Flash...",
    "Drafting historical lore & magic guidelines...",
    "Spawning independent NPC personalities...",
    "Calculating private character agendas & secrets...",
    "Mapping interconnected coordinates...",
    "Compiling starting ASCII maps..."
  ];

  const handleGenerateDraft = async () => {
    if (!prompt.trim()) return;

    setStep("loading_draft");
    setLoadingProgressStep(0);

    const interval = setInterval(() => {
      setLoadingProgressStep((prev) => {
        if (prev < loadingSteps.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 2500);

    try {
      const res = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", prompt }),
      });

      const data = await res.json();
      clearInterval(interval);

      if (data.error) {
        alert("Error generating world draft: " + data.error);
        setStep("input");
      } else {
        const generated = data.draft as WorldDraft;
        setDraft(generated);
        // Prefill character creator
        setCharName(generated.player.name);
        setCharAge(generated.player.age);
        setCharLooks(generated.player.looks);
        setCharSkills(generated.player.skills);
        setStep("editor");
      }
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      alert("Failed to contact API. Check connection.");
      setStep("input");
    }
  };

  const handleSaveAndPlay = async () => {
    if (!draft) return;

    setStep("loading_play");

    try {
      // 1. Save World Template
      const templateRes = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_template", draft }),
      });

      const templateData = await templateRes.json();
      if (templateData.error) {
        alert("Error saving world template: " + templateData.error);
        setStep("character");
        return;
      }

      const { templateStoryId } = templateData;

      // 2. Instantiate Playthrough
      const playRes = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "instantiate",
          templateStoryId,
          customPlayer: {
            name: charName,
            age: charAge,
            looks: charLooks,
            skills: charSkills,
          },
        }),
      });

      const playData = await playRes.json();
      if (playData.error) {
        alert("Error instantiating play: " + playData.error);
        setStep("character");
      } else {
        router.push(`/story?id=${playData.storyId}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to deploy playthrough. Check console.");
      setStep("character");
    }
  };

  const autofillPreset = () => {
    setPrompt(
      "I want to play as the fourth noble son of the Rosenthaal family. I am frail and weak, having contracted the 'white death' soon after birth. I live in my own manor on the outskirts of the kingdom. My family is in the capital and sends me money and regard but ignores me otherwise. This world has magic. Primary characters: Alice my maid, she is blonde, soft-spoken, but acting suspiciously lately."
    );
  };

  // Helper mutators for Draft state
  const handleUpdateLore = (index: number, field: "keyword" | "content", val: string) => {
    if (!draft) return;
    const updatedLore = [...draft.lore];
    updatedLore[index] = { ...updatedLore[index], [field]: val };
    setDraft({ ...draft, lore: updatedLore });
  };

  const handleAddLore = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      lore: [...draft.lore, { keyword: "New Lore Card", content: "Lore details here." }],
    });
  };

  const handleRemoveLore = (idx: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      lore: draft.lore.filter((_, i) => i !== idx),
    });
  };

  const openRoomEditor = (index: number) => {
    if (!draft) return;
    const room = draft.locations[index];
    setSelectedLocIndex(index);
    setLocName(room.name);
    setLocDesc(room.description);
    setLocSensory(room.sensoryTags.join(", "));
  };

  const saveRoomDetails = () => {
    if (!draft || selectedLocIndex === null) return;
    const updatedLocs = [...draft.locations];
    updatedLocs[selectedLocIndex] = {
      ...updatedLocs[selectedLocIndex],
      name: locName,
      description: locDesc,
      sensoryTags: locSensory.split(",").map((s) => s.trim()).filter(Boolean),
    };
    setDraft({ ...draft, locations: updatedLocs });
    setSelectedLocIndex(null);
  };

  const openNpcEditor = (index: number) => {
    if (!draft) return;
    const npc = draft.characters[index];
    setSelectedNpcIndex(index);
    setNpcName(npc.name);
    setNpcBio(npc.publicBio);
    setNpcAgenda(npc.privateAgenda);
    setNpcDialogue(npc.dialogueStyle);
  };

  const saveNpcDetails = () => {
    if (!draft || selectedNpcIndex === null) return;
    const updatedNPCs = [...draft.characters];
    updatedNPCs[selectedNpcIndex] = {
      ...updatedNPCs[selectedNpcIndex],
      name: npcName,
      publicBio: npcBio,
      privateAgenda: npcAgenda,
      dialogueStyle: npcDialogue,
    };
    setDraft({ ...draft, characters: updatedNPCs });
    setSelectedNpcIndex(null);
  };

  const handleAddSkill = () => {
    if (!newSkillText.trim() || charSkills.includes(newSkillText.trim())) return;
    setCharSkills([...charSkills, newSkillText.trim()]);
    setNewSkillText("");
  };

  const handleRemoveSkill = (skill: string) => {
    setCharSkills(charSkills.filter((s) => s !== skill));
  };

  // ----------------------------------------------------
  // STEP: Loading Screens
  // ----------------------------------------------------
  if (step === "loading_draft" || step === "loading_play") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-xl mx-auto space-y-6 bg-card p-12 rounded-3xl border border-border shadow-lg relative overflow-hidden">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <div className="space-y-2 text-center z-10">
          <h3 className="text-xl font-bold text-foreground font-serif">
            {step === "loading_draft" ? "Drafting World Bible" : "Instantiating Chronicles"}
          </h3>
          <p className="text-sm text-muted-foreground animate-pulse font-sans">
            {step === "loading_draft" ? loadingSteps[loadingProgressStep] : "Preparing simulation parameters..."}
          </p>
        </div>
        <div className="w-48 bg-muted h-1.5 rounded-full overflow-hidden z-10">
          <div 
            className="bg-primary h-full transition-all duration-700"
            style={{ width: `${step === "loading_draft" ? ((loadingProgressStep + 1) / loadingSteps.length) * 100 : 80}%` }}
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP: World Bible Editor
  // ----------------------------------------------------
  if (step === "editor" && draft) {
    return (
      <Card className="w-full bg-card border-border shadow-xl flex flex-col max-h-[85vh] rounded-3xl">
        <CardHeader className="border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground font-serif">
                <Scroll className="w-5 h-5 text-primary" />
                World Bible Editor
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Customize generated lore, locations, and NPC cast members before starting.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">Step 2 of 3</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-6">
          <Tabs defaultValue="lore" className="h-full flex flex-col">
            <TabsList className="bg-muted border border-border p-1 w-full justify-start shrink-0 rounded-xl">
              <TabsTrigger value="lore" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                📖 Lore & Factions
              </TabsTrigger>
              <TabsTrigger value="locations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                🗺️ Locations ({draft.locations.length})
              </TabsTrigger>
              <TabsTrigger value="cast" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                👥 NPC Cast ({draft.characters.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB: Lore & Factions */}
            <TabsContent value="lore" className="flex-1 overflow-hidden pt-4 focus-visible:ring-0">
              <ScrollArea className="h-[45vh] pr-4">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">World Title</label>
                    <Input 
                      value={draft.title} 
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="bg-background border-border text-foreground focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Setting & Faction Summaries</label>
                    <Textarea 
                      value={draft.description} 
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="min-h-[100px] bg-background border-border text-foreground focus-visible:ring-primary"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-foreground">Lore Knowledge Cards (Keyword-Triggered)</h4>
                      <Button variant="outline" size="sm" onClick={handleAddLore} className="border-border hover:bg-muted hover:text-primary">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Card
                      </Button>
                    </div>

                    {draft.lore.map((card, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3 relative group">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveLore(idx)}
                          className="absolute right-2 top-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="w-[85%]">
                          <Input 
                            value={card.keyword} 
                            placeholder="Keyword Trigger (e.g. White Death)"
                            onChange={(e) => handleUpdateLore(idx, "keyword", e.target.value)}
                            className="bg-card border-border text-primary font-semibold h-8"
                          />
                        </div>
                        <Textarea 
                          value={card.content} 
                          placeholder="Lore card description that the AI director pulls on query..."
                          onChange={(e) => handleUpdateLore(idx, "content", e.target.value)}
                          className="bg-card border-border text-foreground text-xs min-h-[60px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB: Locations */}
            <TabsContent value="locations" className="flex-1 overflow-hidden pt-4 focus-visible:ring-0">
              <ScrollArea className="h-[45vh] pr-4">
                <div className="grid grid-cols-1 gap-3">
                  {draft.locations.map((loc, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <h4 className="font-semibold text-foreground">{loc.name}</h4>
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Coords: ({loc.coordinates.x}, {loc.coordinates.y})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 pr-6">{loc.description}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {loc.sensoryTags.map((tag, sIdx) => (
                            <span key={sIdx} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Dialog>
                        <DialogTrigger 
                          onClick={() => openRoomEditor(idx)} 
                          className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-transparent text-foreground hover:bg-muted h-8 px-3 transition-colors cursor-pointer shrink-0"
                        >
                          <Edit3 className="w-3 h-3 mr-1 inline" /> Edit
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border text-foreground rounded-3xl">
                          <DialogHeader>
                            <DialogTitle className="font-serif">Edit Room Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Room Name</label>
                              <Input value={locName} onChange={(e) => setLocName(e.target.value)} className="bg-background border-border text-foreground" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Atmospheric Description</label>
                              <Textarea value={locDesc} onChange={(e) => setLocDesc(e.target.value)} className="bg-background border-border text-foreground min-h-[100px]" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Sensory Tags (comma separated)</label>
                              <Input value={locSensory} onChange={(e) => setLocSensory(e.target.value)} className="bg-background border-border text-foreground" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={saveRoomDetails} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg">
                              Save Changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB: Cast Members */}
            <TabsContent value="cast" className="flex-1 overflow-hidden pt-4 focus-visible:ring-0">
              <ScrollArea className="h-[45vh] pr-4">
                <div className="grid grid-cols-1 gap-3">
                  {draft.characters.map((npc, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all flex items-start justify-between">
                      <div className="space-y-2 pr-6">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" />
                          <h4 className="font-semibold text-foreground">{npc.name}</h4>
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Starts: {npc.startingLocationName}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{npc.publicBio}</p>
                        <div className="text-xs p-3 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive-foreground">
                          <span className="font-bold text-[10px] uppercase text-destructive block mb-1">Private Agenda & Secrets:</span>
                          <span className="text-foreground/80">{npc.privateAgenda}</span>
                        </div>
                      </div>
                      <Dialog>
                        <DialogTrigger 
                          onClick={() => openNpcEditor(idx)} 
                          className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-transparent text-foreground hover:bg-muted h-8 px-3 transition-colors cursor-pointer shrink-0"
                        >
                          <Edit3 className="w-3 h-3 mr-1 inline" /> Edit
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border text-foreground max-w-lg rounded-3xl">
                          <DialogHeader>
                            <DialogTitle className="font-serif">Edit NPC Profile</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">NPC Name</label>
                              <Input value={npcName} onChange={(e) => setNpcName(e.target.value)} className="bg-background border-border text-foreground focus-visible:ring-primary" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Public Bio (Sensory details for chat)</label>
                              <Textarea value={npcBio} onChange={(e) => setNpcBio(e.target.value)} className="bg-background border-border text-foreground min-h-[60px] focus-visible:ring-primary" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Private Agenda & Hidden Motives (For AI deliberations only)</label>
                              <Textarea value={npcAgenda} onChange={(e) => setNpcAgenda(e.target.value)} className="bg-background border-border text-foreground min-h-[60px] focus-visible:ring-primary" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Dialogue & Speech Style (E.g. grumpy wizard, quick speech)</label>
                              <Input value={npcDialogue} onChange={(e) => setNpcDialogue(e.target.value)} className="bg-background border-border text-foreground focus-visible:ring-primary" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={saveNpcDetails} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg">
                              Save Changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="border-t border-border shrink-0 p-6 flex justify-between bg-muted/10">
          <Button variant="ghost" onClick={() => setStep("input")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={() => setStep("character")} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md rounded-xl font-bold">
            Next: Character Creator <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ----------------------------------------------------
  // STEP: Protagonist Character Creator
  // ----------------------------------------------------
  if (step === "character" && draft) {
    return (
      <Card className="w-full max-w-xl mx-auto bg-card border-border shadow-xl flex flex-col max-h-[85vh] rounded-3xl">
        <CardHeader className="border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground font-serif">
                <User className="w-5 h-5 text-primary" />
                Character Creator
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Create and tailor the protagonist you will play as.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">Step 3 of 3</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-6">
          <ScrollArea className="h-[45vh] pr-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Character Name</label>
                <Input 
                  value={charName} 
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder="E.g., Aiden Rosenthaal"
                  className="bg-background border-border text-foreground focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Age</label>
                <Input 
                  type="number"
                  value={charAge} 
                  onChange={(e) => setCharAge(Number(e.target.value))}
                  className="bg-background border-border text-foreground focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Appearance & Traits</label>
                <Textarea 
                  value={charLooks} 
                  onChange={(e) => setCharLooks(e.target.value)}
                  placeholder="Describe your appearance, height, hair, clothing, or physical frailties..."
                  className="bg-background border-border text-foreground focus-visible:ring-primary min-h-[80px]"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">Character Skills & Attributes</label>
                
                <div className="flex gap-2">
                  <Input 
                    value={newSkillText}
                    onChange={(e) => setNewSkillText(e.target.value)}
                    placeholder="E.g., Alchemy, Swordplay, Stealth"
                    className="bg-background border-border text-foreground focus-visible:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                  />
                  <Button onClick={handleAddSkill} variant="outline" className="border-border text-foreground hover:bg-muted shrink-0">
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {charSkills.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No skills added yet. Add skills to give GM context.</span>
                  ) : (
                    charSkills.map((skill) => (
                      <Badge 
                        key={skill} 
                        variant="secondary" 
                        className="bg-primary/5 border border-primary/10 hover:border-destructive/30 hover:bg-destructive/5 text-primary transition-colors pr-1 cursor-pointer rounded-full"
                        onClick={() => handleRemoveSkill(skill)}
                      >
                        {skill}
                        <Trash2 className="w-3 h-3 ml-1 text-muted-foreground hover:text-destructive inline" />
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t border-border shrink-0 p-6 flex justify-between bg-muted/10">
          <Button variant="ghost" onClick={() => setStep("editor")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={handleSaveAndPlay} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md px-6 font-bold rounded-xl">
            Begin Chronicles <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ----------------------------------------------------
  // STEP: Standard Dashboard (Scenario Input)
  // ----------------------------------------------------
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      
      {/* Creation Pane */}
      <Card className="bg-card border-border shadow-xl relative overflow-hidden rounded-3xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground font-serif">
            <Sparkles className="w-5 h-5 text-primary" />
            Draft a New Scenario
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Type a few sentences describing who you are, the setting, and initial characters. The GM will populate the rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., I am a rogue street urchin in a steampunk city. I have a mechanical pocket watch. My rival is Marcus, a wealthy noble thief who is plotting to betray me..."
            className="min-h-[160px] bg-background border-border text-foreground placeholder-muted-foreground focus-visible:ring-primary rounded-xl"
          />
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-sans">Powered by Gemini 3.5 Flash</span>
            <Button
              variant="link"
              onClick={autofillPreset}
              className="text-primary hover:text-primary/80 hover:underline p-0 h-auto text-xs font-semibold"
            >
              Autofill Rosenthaal Manor Preset
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleGenerateDraft}
            disabled={!prompt.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md font-bold rounded-xl h-10"
          >
            Draft World Bible & Next <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>

      {/* History Pane */}
      <Card className="bg-card border-border shadow-xl h-[440px] flex flex-col rounded-3xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground font-serif">
            <BookOpen className="w-5 h-5 text-primary" />
            Resume Chronicles
          </CardTitle>
          <CardDescription className="text-muted-foreground">Select an active story world to return to your scene.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            {initialStories.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm font-sans italic">
                No active chronicles found. Create your first world above!
              </div>
            ) : (
              <div className="space-y-3">
                {initialStories.map((story) => (
                  <div
                    key={story.id}
                    onClick={() => router.push(`/story?id=${story.id}`)}
                    className="p-4 rounded-2xl bg-muted/20 border border-border hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer group flex items-start justify-between"
                  >
                    <div className="space-y-1 pr-4">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors font-serif text-base">
                        {story.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 pr-2 leading-relaxed">
                        {story.description || "No description provided."}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 text-[10px] text-muted-foreground">
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
