import type { VercelRequest, VercelResponse } from '@vercel/node';

const ROOMS = [
  { id: 'general',       name: 'General',        description: 'Main chat for everyone' },
  { id: 'retro-gaming',  name: 'Retro Gaming',   description: 'NES, SNES, N64 and classic games' },
  { id: 'custom-engines',name: 'Custom Engines',  description: 'Wargus, Avernus, Tower Defense talk' },
  { id: 'trading',       name: 'Trading Post',    description: 'Buy, sell, trade GBUX and assets' },
];

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.json(ROOMS);
}
