"use client";

import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronUp, ChevronDown } from "lucide-react";

interface AsciiMapProps {
  asciiMap: string;
  onMove: (direction: string) => void;
}

export default function AsciiMap({ asciiMap, onMove }: AsciiMapProps) {
  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
      <div className="text-sm font-bold text-foreground font-serif">Navigation Map</div>
      
      {/* ASCII Viewport */}
      <div className="flex-1 bg-[#f0f4f1] rounded-2xl border border-border/60 p-4 flex items-center justify-center overflow-auto min-h-[180px] shadow-inner">
        <pre className="font-mono text-[11px] sm:text-xs leading-5 text-primary font-bold select-none whitespace-pre">
          {asciiMap || "Loading location mappings..."}
        </pre>
      </div>

      {/* Touch-Friendly D-Pad */}
      <div className="flex flex-col items-center justify-center p-3 bg-muted/20 rounded-2xl border border-border max-w-[280px] mx-auto w-full">
        <span className="text-[10px] text-muted-foreground font-bold mb-3 uppercase tracking-widest">Touch Compass</span>
        <div className="grid grid-cols-3 gap-2 w-full max-w-[180px]">
          {/* Row 1 */}
          <div />
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("n")}
            className="border-border hover:bg-muted text-muted-foreground hover:text-primary h-10 w-10 mx-auto bg-card rounded-xl shadow-sm"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMove("u")}
            className="border-border hover:bg-muted text-[10px] text-muted-foreground hover:text-primary h-10 w-10 mx-auto flex flex-col justify-center items-center bg-card rounded-xl shadow-sm"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            UP
          </Button>

          {/* Row 2 */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("w")}
            className="border-border hover:bg-muted text-muted-foreground hover:text-primary h-10 w-10 mx-auto bg-card rounded-xl shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-10 w-10 rounded-full border border-border bg-card flex items-center justify-center mx-auto text-[9px] font-bold text-muted-foreground shadow-sm">
            MOV
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("e")}
            className="border-border hover:bg-muted text-muted-foreground hover:text-primary h-10 w-10 mx-auto bg-card rounded-xl shadow-sm"
          >
            <ArrowRight className="w-4 h-4" />
          </Button>

          {/* Row 3 */}
          <div />
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("s")}
            className="border-border hover:bg-muted text-muted-foreground hover:text-primary h-10 w-10 mx-auto bg-card rounded-xl shadow-sm"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMove("d")}
            className="border-border hover:bg-muted text-[10px] text-muted-foreground hover:text-primary h-10 w-10 mx-auto flex flex-col justify-center items-center bg-card rounded-xl shadow-sm"
          >
            DN
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
