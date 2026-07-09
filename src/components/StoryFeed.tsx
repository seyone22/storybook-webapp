"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit2, Check, X, RotateCcw, HelpCircle } from "lucide-react";

interface LogMessage {
  id: string;
  speaker: string;
  text: string;
  isSystem: boolean;
}

interface StoryFeedProps {
  logs: LogMessage[];
  onEdit: (id: string, newText: string) => void;
  onUndo: () => void;
  onReroll: () => void;
}

export default function StoryFeed({ logs, onEdit, onUndo, onReroll }: StoryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Scroll to bottom when logs update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const startEdit = (msg: LogMessage) => {
    setEditingId(msg.id);
    // Combine speaker + text for the raw DB representation
    const rawVal = msg.isSystem ? msg.text : `${msg.speaker}: ${msg.text}`;
    setEditText(rawVal);
  };

  const saveEdit = (id: string) => {
    if (editText.trim()) {
      onEdit(id, editText);
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Top Menu / Quick Actions */}
      <div className="flex justify-between items-center bg-muted/30 px-4 py-3 border-b border-border">
        <span className="text-sm font-bold text-foreground font-serif">Story Transcript</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onUndo}
            disabled={logs.length < 2}
            className="border-border hover:bg-muted text-muted-foreground hover:text-destructive h-8 text-xs gap-1 rounded-lg"
            title="Step back one turn (Delete player input + last response)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo Turn
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReroll}
            disabled={logs.length === 0}
            className="border-border hover:bg-muted text-muted-foreground hover:text-primary h-8 text-xs gap-1 rounded-lg"
            title="Reroll last NPC response"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Reroll
          </Button>
        </div>
      </div>

      {/* Main logs display */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {logs.map((msg) => {
            const isEditing = editingId === msg.id;

            if (isEditing) {
              return (
                <div key={msg.id} className="p-3 rounded-xl bg-card border border-primary/50 space-y-2 animate-in fade-in duration-200">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="bg-background border-border text-foreground min-h-[60px] rounded-lg"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="outline" onClick={() => setEditingId(null)} className="h-7 w-7 text-muted-foreground border-border rounded-lg">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" className="h-7 w-7 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg" onClick={() => saveEdit(msg.id)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`group relative p-4 rounded-xl border transition-all ${
                  msg.isSystem
                    ? "bg-muted/30 border-border/40 text-muted-foreground font-mono"
                    : msg.speaker === "You"
                    ? "bg-primary/5 border-primary/10 text-foreground ml-6 shadow-sm"
                    : "bg-muted/10 border-border/30 text-foreground mr-6 shadow-sm"
                }`}
              >
                {/* Floating Edit Button (visible on hover) */}
                <button
                  onClick={() => startEdit(msg)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-primary rounded hover:bg-muted cursor-pointer"
                  title="Edit message"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Content Render */}
                {msg.isSystem ? (
                  <div className="text-xs italic leading-relaxed">{msg.text}</div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary font-sans">{msg.speaker}</div>
                    <div className="text-base leading-relaxed whitespace-pre-wrap font-serif text-foreground/90">
                      {(() => {
                        const cleanText = msg.text.replace(/\[Speech\]|\[Action\]/g, "").trim();
                        // Split by double quotes, keeping the quotes
                        const parts = cleanText.split(/(".*?")/g);
                        return (
                          <>
                            {parts.map((part, idx) => {
                              const isQuote = part.startsWith('"') && part.endsWith('"');
                              if (isQuote) {
                                return (
                                  <span key={idx} className="text-foreground font-medium italic">
                                    {part}
                                  </span>
                                );
                              }
                              return (
                                <span key={idx} className="text-foreground/80">
                                  {part}
                                </span>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
