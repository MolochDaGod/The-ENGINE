const ROOMS = [
  { id: "general", name: "General", description: "Main lobby — say hi, find your crew", category: "community" },
  { id: "builds", name: "Builds", description: "Show builds, demos, and work-in-progress", category: "community" },
  { id: "help", name: "Help", description: "Get unstuck — ask the community", category: "community" },
  { id: "retro-gaming", name: "Retro", description: "NES, SNES, N64 & classic arcade talk", category: "play" },
  { id: "custom-engines", name: "Engines", description: "Wargus, Avernus, Tower Defense & Nexus", category: "play" },
  { id: "trading", name: "Trading", description: "GBUX, assets, and marketplace deals", category: "economy" },
];

export default function handler(_req: any, res: any) {
  return res.json(ROOMS);
}