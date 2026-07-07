"use client";

import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronUp, ChevronDown } from "lucide-react";

interface AsciiMapProps {
  asciiMap: string;
  onMove: (direction: string) => void;
}

export default function AsciiMap({ asciiMap, onMove }: AsciiMapProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-xl p-4 backdrop-blur-sm space-y-4">
      <div className="text-sm font-semibold text-slate-400">Navigation Map</div>
      
      {/* ASCII Viewport */}
      <div className="flex-1 bg-black rounded-lg border border-slate-950 p-4 flex items-center justify-center overflow-auto min-h-[180px]">
        <pre className="font-mono text-[11px] sm:text-xs leading-5 text-emerald-400 select-none whitespace-pre">
          {asciiMap || "Loading location mappings..."}
        </pre>
      </div>

      {/* Touch-Friendly D-Pad */}
      <div className="flex flex-col items-center justify-center p-2 bg-slate-950/40 rounded-lg border border-slate-900/60 max-w-[280px] mx-auto w-full">
        <span className="text-[10px] text-slate-600 font-bold mb-2 uppercase tracking-widest">Touch Compass</span>
        <div className="grid grid-cols-3 gap-2 w-full max-w-[180px]">
          {/* Row 1 */}
          <div />
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("n")}
            className="border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-violet-400 h-10 w-10 mx-auto"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMove("u")}
            className="border-slate-800 hover:bg-slate-900 text-[10px] text-slate-500 hover:text-cyan-400 h-10 w-10 mx-auto flex flex-col justify-center items-center"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            UP
          </Button>

          {/* Row 2 */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("w")}
            className="border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-violet-400 h-10 w-10 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-10 w-10 rounded-full border border-slate-900 bg-slate-950 flex items-center justify-center mx-auto text-[10px] font-bold text-slate-700">
            MOV
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("e")}
            className="border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-violet-400 h-10 w-10 mx-auto"
          >
            <ArrowRight className="w-4 h-4" />
          </Button>

          {/* Row 3 */}
          <div />
          <Button
            size="icon"
            variant="outline"
            onClick={() => onMove("s")}
            className="border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-violet-400 h-10 w-10 mx-auto"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMove("d")}
            className="border-slate-800 hover:bg-slate-900 text-[10px] text-slate-500 hover:text-cyan-400 h-10 w-10 mx-auto flex flex-col justify-center items-center"
          >
            DN
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
