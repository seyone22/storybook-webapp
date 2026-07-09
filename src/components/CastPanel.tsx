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
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl p-4 shadow-sm space-y-6">
      
      {/* 1. Player Profile */}
      <div className="space-y-2">
        <div className="text-sm font-bold text-foreground font-serif">Protagonist Sheet</div>
        <Card className="bg-muted/15 border-border shadow-sm rounded-xl">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-md font-bold text-primary flex items-center justify-between font-serif">
              {playerStats.name}
              <div className="flex gap-1">
                {playerStats.status.map((st) => (
                  <Badge key={st} variant="destructive" className="text-[9px] px-1.5 py-0 rounded-full uppercase">
                    {st}
                  </Badge>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-xs text-muted-foreground leading-relaxed">
            {playerStats.bio}
          </CardContent>
        </Card>
      </div>

      {/* 2. Cast of Characters */}
      <div className="flex-1 flex flex-col space-y-2 overflow-hidden min-h-[200px]">
        <div className="text-sm font-bold text-foreground flex items-center justify-between font-serif">
          <span>Active Cast ({cast.length})</span>
          <Users className="w-4 h-4 text-muted-foreground" />
        </div>
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-3">
            {cast.map((char) => (
              <Card 
                key={char.id} 
                className={`bg-card border ${
                  char.isPlayerInRoom ? "border-primary/35 bg-primary/5" : "border-border"
                } transition-all rounded-xl shadow-sm`}
              >
                <CardContent className="p-3 space-y-3">
                  {/* Name + Status */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5 font-serif">
                        {char.name}
                        {char.isPlayerInRoom && (
                          <span className="text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-sans font-normal">
                            Present
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{char.locationName}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {char.status.map((st) => (
                        <Badge key={st} variant="outline" className="text-[8px] px-1.5 py-0 text-muted-foreground border-border rounded-full">
                          {st}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Public Bio */}
                  <p className="text-[11px] text-muted-foreground leading-relaxed italic border-l-2 border-border pl-2">
                    {char.publicBio}
                  </p>

                  {/* Relationship meters */}
                  <div className="space-y-2 pt-1">
                    {/* Trust Meter */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-2.5 h-2.5 text-primary" />
                          Trust
                        </span>
                        <span className="font-semibold text-primary">{char.trust}%</span>
                      </div>
                      <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="bg-primary h-full" style={{ width: `${char.trust}%` }} />
                      </div>
                    </div>

                    {/* Hostility Meter */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Swords className="w-2.5 h-2.5 text-destructive" />
                          Hostility
                        </span>
                        <span className="font-semibold text-destructive">{char.hostility}%</span>
                      </div>
                      <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="bg-destructive h-full" style={{ width: `${char.hostility}%` }} />
                      </div>
                    </div>

                    {/* Suspicion Meter */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5 text-amber-600" />
                          Suspicion
                        </span>
                        <span className="font-semibold text-amber-700">{char.suspicion}%</span>
                      </div>
                      <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="bg-amber-600 h-full" style={{ width: `${char.suspicion}%` }} />
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
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
        
        {/* Room Items */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            ON THE GROUND
          </div>
          <ScrollArea className="h-[90px] bg-muted/15 rounded-xl border border-border p-2">
            {roomItems.length === 0 ? (
              <span className="text-[10px] text-muted-foreground/60 block italic py-2 text-center">Nothing here</span>
            ) : (
              <div className="space-y-1.5">
                {roomItems.map((item) => (
                  <div key={item.id} className="text-[10px] text-muted-foreground bg-card border border-border/60 p-1.5 rounded-lg shadow-sm" title={item.description}>
                    <div className="font-bold text-foreground">{item.name}</div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Player Inventory */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            YOUR INVENTORY
          </div>
          <ScrollArea className="h-[90px] bg-muted/15 rounded-xl border border-border p-2">
            {inventory.length === 0 ? (
              <span className="text-[10px] text-muted-foreground/60 block italic py-2 text-center">Empty pack</span>
            ) : (
              <div className="space-y-1.5">
                {inventory.map((item) => (
                  <div key={item.id} className="text-[10px] text-muted-foreground bg-card border border-border/60 p-1.5 rounded-lg shadow-sm" title={item.description}>
                    <div className="font-bold text-foreground">{item.name}</div>
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
