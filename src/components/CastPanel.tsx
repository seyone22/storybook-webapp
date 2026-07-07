"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Package, Heart, Swords, Eye } from "lucide-react";

interface CastMember {
  id: string;
  name: string;
  publicBio: string;
  status: string[];
  locationName: string;
  trust: number;
  hostility: number;
  suspicion: number;
  isPlayerInRoom: boolean;
}

interface Item {
  id: string;
  name: string;
  description: string;
}

interface CastPanelProps {
  cast: CastMember[];
  roomItems: Item[];
  inventory: Item[];
  playerStats: {
    name: string;
    bio: string;
    status: string[];
  };
}

export default function CastPanel({ cast, roomItems, inventory, playerStats }: CastPanelProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-xl p-4 backdrop-blur-sm space-y-6">
      
      {/* 1. Player Profile */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-400">Protagonist Sheet</div>
        <Card className="bg-slate-950/60 border-slate-900 shadow-md">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-md font-bold text-violet-400 flex items-center justify-between">
              {playerStats.name}
              <div className="flex gap-1">
                {playerStats.status.map((st) => (
                  <Badge key={st} variant="destructive" className="text-[9px] px-1 py-0 uppercase">
                    {st}
                  </Badge>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-xs text-slate-400 leading-relaxed">
            {playerStats.bio}
          </CardContent>
        </Card>
      </div>

      {/* 2. Cast of Characters */}
      <div className="flex-1 flex flex-col space-y-2 overflow-hidden min-h-[200px]">
        <div className="text-sm font-semibold text-slate-400 flex items-center justify-between">
          <span>Active Cast ({cast.length})</span>
          <Users className="w-4 h-4 text-slate-500" />
        </div>
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-3">
            {cast.map((char) => (
              <Card 
                key={char.id} 
                className={`bg-slate-950/40 border ${
                  char.isPlayerInRoom ? "border-violet-500/30 bg-slate-950/80" : "border-slate-900"
                } transition-all`}
              >
                <CardContent className="p-3 space-y-3">
                  {/* Name + Status */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        {char.name}
                        {char.isPlayerInRoom && (
                          <span className="text-[9px] bg-violet-900/60 text-violet-300 border border-violet-700/50 px-1 rounded font-normal">
                            Present
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">{char.locationName}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {char.status.map((st) => (
                        <Badge key={st} variant="outline" className="text-[8px] px-1 py-0 text-slate-400 border-slate-800">
                          {st}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Public Bio */}
                  <p className="text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-slate-800 pl-2">
                    {char.publicBio}
                  </p>

                  {/* Relationship meters */}
                  <div className="space-y-2 pt-1">
                    {/* Trust Meter */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Heart className="w-2.5 h-2.5 text-emerald-500" />
                          Trust
                        </span>
                        <span className="font-semibold text-emerald-400">{char.trust}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${char.trust}%` }} />
                      </div>
                    </div>

                    {/* Hostility Meter */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Swords className="w-2.5 h-2.5 text-red-500" />
                          Hostility
                        </span>
                        <span className="font-semibold text-red-400">{char.hostility}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full" style={{ width: `${char.hostility}%` }} />
                      </div>
                    </div>

                    {/* Suspicion Meter */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5 text-amber-500" />
                          Suspicion
                        </span>
                        <span className="font-semibold text-amber-400">{char.suspicion}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: `${char.suspicion}%` }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 3. Items and Inventories */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-900">
        
        {/* Room Items */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            ON THE GROUND
          </div>
          <ScrollArea className="h-[90px] bg-slate-950/40 rounded border border-slate-900 p-2">
            {roomItems.length === 0 ? (
              <span className="text-[10px] text-slate-600 block italic py-2 text-center">Nothing here</span>
            ) : (
              <div className="space-y-1.5">
                {roomItems.map((item) => (
                  <div key={item.id} className="text-[10px] text-slate-350 bg-slate-950/80 p-1.5 rounded" title={item.description}>
                    <div className="font-bold text-slate-200">{item.name}</div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Player Inventory */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            YOUR INVENTORY
          </div>
          <ScrollArea className="h-[90px] bg-slate-950/40 rounded border border-slate-900 p-2">
            {inventory.length === 0 ? (
              <span className="text-[10px] text-slate-600 block italic py-2 text-center">Empty pack</span>
            ) : (
              <div className="space-y-1.5">
                {inventory.map((item) => (
                  <div key={item.id} className="text-[10px] text-slate-350 bg-slate-950/80 p-1.5 rounded" title={item.description}>
                    <div className="font-bold text-slate-200">{item.name}</div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

      </div>

    </div>
  );
}
