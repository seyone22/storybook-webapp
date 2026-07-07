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
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Top Menu / Quick Actions */}
      <div className="flex justify-between items-center bg-slate-950/60 px-4 py-2 border-b border-slate-800">
        <span className="text-sm font-semibold text-slate-400">Story Transcript</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onUndo}
            disabled={logs.length < 2}
            className="border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-red-400 h-8 text-xs gap-1"
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
            className="border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-violet-400 h-8 text-xs gap-1"
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
                <div key={msg.id} className="p-3 rounded-lg bg-slate-950 border border-violet-500/50 space-y-2 animate-in fade-in duration-200">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="bg-slate-900 border-slate-800 text-slate-100 min-h-[60px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="outline" onClick={() => setEditingId(null)} className="h-7 w-7 text-slate-400 border-slate-800">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" className="h-7 w-7 bg-violet-600 hover:bg-violet-500" onClick={() => saveEdit(msg.id)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`group relative p-3 rounded-lg border transition-all ${
                  msg.isSystem
                    ? "bg-slate-950/60 border-slate-900/60 text-slate-350"
                    : msg.speaker === "You"
                    ? "bg-violet-950/20 border-violet-900/30 text-slate-100 ml-6"
                    : "bg-slate-950/30 border-slate-900/20 text-slate-200 mr-6"
                }`}
              >
                {/* Floating Edit Button (visible on hover) */}
                <button
                  onClick={() => startEdit(msg)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-violet-400 rounded hover:bg-slate-900"
                  title="Edit message"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Content Render */}
                {msg.isSystem ? (
                  <div className="text-xs font-mono text-slate-400">{msg.text}</div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-violet-400">{msg.speaker}</div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.text.startsWith("[Speech]") ? (
                        <span className="italic text-slate-100">{msg.text.replace("[Speech]", "").trim()}</span>
                      ) : msg.text.startsWith("[Action]") ? (
                        <span className="text-slate-400 font-mono">{msg.text.replace("[Action]", "").trim()}</span>
                      ) : (
                        msg.text
                      )}
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
