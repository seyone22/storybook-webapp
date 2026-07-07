interface Location {
  id: string;
  name: string;
  coordinates: { x: number; y: number };
  connections: Record<string, string>;
}

interface Character {
  name: string;
  locationId: string | null;
  isPlayer: boolean;
}

export function compileAsciiMap(
  locations: Location[],
  activeLocationId: string,
  characters: Character[]
): string {
  if (locations.length === 0) return "No map available.";

  // Find boundaries of coordinates
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  locations.forEach((loc) => {
    const { x, y } = loc.coordinates;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  // If bounds are somehow infinite, fallback
  if (minX === Infinity) {
    minX = 0; maxX = 0; minY = 0; maxY = 0;
  }

  // Create mapping from coordinate string (x,y) to Location
  const coordMap = new Map<string, Location>();
  locations.forEach((loc) => {
    coordMap.set(`${loc.coordinates.x},${loc.coordinates.y}`, loc);
  });

  // Group characters by locationId
  const charMap = new Map<string, Character[]>();
  characters.forEach((char) => {
    if (char.locationId) {
      const list = charMap.get(char.locationId) || [];
      list.push(char);
      charMap.set(char.locationId, list);
    }
  });

  // We will build a character cell matrix
  // Cell size: 3 rows high, 16 characters wide
  // Cell template:
  // Row 0: " [ RoomName ] " or "[*RoomName*]" if active
  // Row 1: " (CharInitials)" (e.g. " (You, Alice)")
  // Row 2: "      │       " (connection indicator if there is a room below)

  const cellWidth = 18;
  const cellHeight = 3;

  const gridWidth = (maxX - minX + 1) * cellWidth;
  const gridHeight = (maxY - minY + 1) * cellHeight;

  // Initialize empty character buffer
  const buffer: string[][] = Array.from({ length: gridHeight }, () =>
    Array(gridWidth).fill(" ")
  );

  // Helper to write string into buffer at index (row, col)
  const writeBuffer = (r: number, c: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      if (r >= 0 && r < gridHeight && c + i >= 0 && c + i < gridWidth) {
        buffer[r][c + i] = str[i];
      }
    }
  };

  // Draw cells
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const loc = coordMap.get(`${x},${y}`);
      if (!loc) continue;

      // Local grid row/col
      const r = (y - minY) * cellHeight;
      const c = (x - minX) * cellWidth;

      // 1. Draw Room name
      const isActive = loc.id === activeLocationId;
      // Truncate name to fit 14 characters
      let roomName = loc.name;
      if (roomName.length > 12) {
        roomName = roomName.substring(0, 9) + "...";
      }
      const label = isActive ? `[*${roomName}*]` : `[ ${roomName} ]`;
      // Center the label inside the cell width (18 chars)
      const labelOffset = Math.max(0, Math.floor((cellWidth - label.length) / 2));
      writeBuffer(r, c + labelOffset, label);

      // 2. Draw Characters present
      const locChars = charMap.get(loc.id) || [];
      if (locChars.length > 0) {
        const charNames = locChars.map((ch) => (ch.isPlayer ? "You" : ch.name)).join(", ");
        let charString = `(${charNames})`;
        if (charString.length > 16) {
          charString = charString.substring(0, 13) + "...)";
        }
        const charOffset = Math.max(0, Math.floor((cellWidth - charString.length) / 2));
        writeBuffer(r + 1, c + charOffset, charString);
      }

      // 3. Draw connections
      // If there is a room to the East (x + 1, y), and they are connected
      const eastLoc = coordMap.get(`${x + 1},${y}`);
      if (eastLoc && (loc.connections.e === eastLoc.id || eastLoc.connections.w === loc.id)) {
        // Draw horizontal connection in Row 0 (aligned with room labels)
        const lineOffset = c + cellWidth - 3;
        writeBuffer(r, lineOffset, "───");
      }

      // If there is a room to the South (x, y + 1), and they are connected
      const southLoc = coordMap.get(`${x},${y + 1}`);
      if (southLoc && (loc.connections.s === southLoc.id || southLoc.connections.n === loc.id)) {
        // Draw vertical connection in Row 2 (centered in cell width)
        const colCenter = c + Math.floor(cellWidth / 2);
        writeBuffer(r + 2, colCenter, "│");
      }
    }
  }

  // Convert buffer to single string
  return buffer.map((row) => row.join("").trimEnd()).join("\n");
}
