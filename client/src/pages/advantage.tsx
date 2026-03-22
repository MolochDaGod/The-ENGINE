import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Code, Palette, Music, Map, Gamepad2, Star, Zap, Users, Shield, Boxes, Wand2, Volume2, Layers, PenTool, Cpu, Globe, Sword } from "lucide-react";
import { Link } from "wouter";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";

interface ToolItem {
  name: string;
  category: string;
  description: string;
  icon: typeof Gamepad2;
  color: string;
  url: string;
  pricing: string;
}

const gameEngines: ToolItem[] = [
  { name: "Construct 3", category: "Game Engine", description: "Web-based no-code game engine with drag-and-drop interface for 2D games. Features physics, pathfinding, and multiplayer.", icon: Gamepad2, color: "#2196F3", url: "https://www.construct.net", pricing: "Free Tier" },
  { name: "Buildbox", category: "Game Engine", description: "Visual no-code game engine for creating 2D and 3D games with animations, effects, and sound systems.", icon: Boxes, color: "#FF9800", url: "https://www.buildbox.com", pricing: "Subscription" },
  { name: "GDevelop", category: "Game Engine", description: "Open-source no-code game engine using visual scripting. Physics, particles, and multiplayer capabilities.", icon: Code, color: "#4CAF50", url: "https://gdevelop.io", pricing: "Free & Open Source" },
  { name: "Stencyl", category: "Game Engine", description: "Drag-and-drop game creation platform with physics, animation tools, and integrated sound for 2D games.", icon: Layers, color: "#9C27B0", url: "https://www.stencyl.com", pricing: "Free for Web" },
  { name: "Yahaha Studios", category: "Game Engine", description: "Anyone can make a game with no coding skills required. User-friendly 3D experience creation platform.", icon: Globe, color: "#00BCD4", url: "https://yahaha.com", pricing: "Free to Start" },
  { name: "RPG Maker", category: "Game Engine", description: "Create Final Fantasy style RPG games with a simple editor. Perfect for storytelling and classic RPG experiences.", icon: Sword, color: "#E91E63", url: "https://www.rpgmakerweb.com", pricing: "One-time Purchase" },
];

const assetTools: ToolItem[] = [
  { name: "Adobe Photoshop", category: "Graphics", description: "Industry-standard tool for creating custom graphics, animations, UI elements, and promotional materials.", icon: Palette, color: "#31A8FF", url: "https://www.adobe.com/products/photoshop.html", pricing: "Creative Cloud" },
  { name: "Blender", category: "3D Modeling", description: "Professional 3D modeling for creating game models and animations. Essential for 3D game development.", icon: Boxes, color: "#F5792A", url: "https://www.blender.org", pricing: "Free & Open Source" },
  { name: "Aseprite", category: "Pixel Art", description: "Specialized pixel art tool for creating retro-style 2D game graphics. Perfect for indie game development.", icon: PenTool, color: "#7C4DFF", url: "https://www.aseprite.org", pricing: "One-time Purchase" },
  { name: "Inkscape", category: "Vector Graphics", description: "Vector graphics tool for scalable game UI elements and logos that work at any resolution.", icon: Wand2, color: "#FF6F00", url: "https://inkscape.org", pricing: "Free & Open Source" },
];

const audioTools: ToolItem[] = [
  { name: "FL Studio", category: "Music Production", description: "Professional DAW for creating game music, soundtracks, and ambient audio.", icon: Music, color: "#FF5722", url: "https://www.image-line.com", pricing: "Lifetime License" },
  { name: "Audacity", category: "Audio Editing", description: "Free audio editing for sound effects, voice-overs, and music for games.", icon: Volume2, color: "#0099CC", url: "https://www.audacityteam.org", pricing: "Free & Open Source" },
  { name: "LMMS", category: "Music Production", description: "Free DAW for creating game music and sound design without expensive software.", icon: Music, color: "#4CAF50", url: "https://lmms.io", pricing: "Free & Open Source" },
  { name: "Bfxr / SFXR", category: "Sound Effects", description: "Retro-style sound effect generators perfect for arcade and indie game SFX.", icon: Zap, color: "#FFB300", url: "https://www.bfxr.net", pricing: "Free" },
];

const mapTools: ToolItem[] = [
  { name: "Tiled", category: "Map Editor", description: "Professional map editor for creating game levels. Supports multiple formats and exports to various engines.", icon: Map, color: "#009688", url: "https://www.mapeditor.org", pricing: "Free & Open Source" },
];

function ToolCard({ tool }: { tool: ToolItem }) {
  const Icon = tool.icon;
  return (
    <Card className="border-[hsl(43,60%,30%)]/30 bg-[hsl(225,28%,12%)] hover:bg-[hsl(225,28%,14%)] transition-all duration-300 hover:border-[hsl(43,60%,30%)]/60 group">
      <CardHeader className="pb-3">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: `${tool.color}20`, border: `1px solid ${tool.color}40` }}>
          <Icon className="w-7 h-7" style={{ color: tool.color }} />
        </div>
        <CardTitle className="text-[hsl(45,30%,90%)] text-lg flex items-center justify-between">
          {tool.name}
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-3 h-3 ${i < 4 ? 'text-[hsl(43,85%,55%)] fill-current' : 'text-[hsl(225,20%,30%)]'}`} />
            ))}
          </div>
        </CardTitle>
        <Badge variant="outline" className="w-fit text-xs border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)]">{tool.category}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-[hsl(45,15%,55%)] text-sm mb-4 leading-relaxed">{tool.description}</p>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-[hsl(45,15%,45%)]">Pricing:</span>
          <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/40">{tool.pricing}</Badge>
        </div>
        <a href={tool.url} target="_blank" rel="noopener noreferrer">
          <Button className="w-full gilded-button" size="sm">
            <ExternalLink className="w-3 h-3 mr-2" />
            Visit Website
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

export default function GrudgeStudioAdvantage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))' }}>
      <div className="relative overflow-hidden py-20 px-4" style={{ background: 'linear-gradient(180deg, hsl(225,30%,8%), hsl(225,30%,5%))' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, hsl(43,85%,55%) 0%, transparent 50%), radial-gradient(circle at 70% 30%, hsl(280,60%,40%) 0%, transparent 40%)' }} />
        <div className="container mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <img src={grudgeLogo} alt="Grudge Studio" className="w-12 h-12" />
              <Badge className="bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)] text-lg px-6 py-2 font-heading">
                Grudge Studio Advantage
              </Badge>
            </div>
            <h1 className="text-5xl font-heading gold-text font-bold mb-6">
              Complete Game Development Ecosystem
            </h1>
            <p className="text-xl text-[hsl(45,15%,60%)] max-w-4xl mx-auto leading-relaxed font-body">
              Access our comprehensive suite of no-code game engines and professional asset creation tools.
              From concept to deployment — everything you need to create amazing games.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {[
              { icon: Gamepad2, title: "6 Game Engines", desc: "No-code platforms for every type of game" },
              { icon: Palette, title: "10+ Asset Tools", desc: "Professional graphics, audio, and design" },
              { icon: Cpu, title: "Custom Engines", desc: "Wargus, Avernus, Tower Defense & more" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6" style={{ background: 'hsl(43,85%,55%,0.1)', border: '1px solid hsl(43,60%,30%,0.3)' }}>
                  <item.icon className="w-10 h-10 text-[hsl(43,85%,55%)]" />
                </div>
                <h3 className="text-2xl font-heading text-[hsl(45,30%,90%)] mb-3" style={{ WebkitTextFillColor: 'unset' }}>{item.title}</h3>
                <p className="text-[hsl(45,15%,55%)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading gold-text font-bold mb-4">No-Code Game Engines</h2>
            <p className="text-lg text-[hsl(45,15%,55%)] max-w-3xl mx-auto font-body">
              Create games without programming using these powerful visual development platforms.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gameEngines.map((engine, i) => <ToolCard key={i} tool={engine} />)}
          </div>
        </section>

        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading gold-text font-bold mb-4">Asset Creation Tools</h2>
            <p className="text-lg text-[hsl(45,15%,55%)] max-w-3xl mx-auto font-body">
              Professional software for creating graphics, 3D models, and visual assets.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {assetTools.map((tool, i) => <ToolCard key={i} tool={tool} />)}
          </div>
        </section>

        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading gold-text font-bold mb-4">Audio Creation Tools</h2>
            <p className="text-lg text-[hsl(45,15%,55%)] max-w-3xl mx-auto font-body">
              Create music, sound effects, and audio that bring your games to life.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {audioTools.map((tool, i) => <ToolCard key={i} tool={tool} />)}
          </div>
        </section>

        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading gold-text font-bold mb-4">Level Design Tools</h2>
            <p className="text-lg text-[hsl(45,15%,55%)] max-w-3xl mx-auto font-body">
              Create engaging game levels and environments with professional mapping tools.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {mapTools.map((tool, i) => <ToolCard key={i} tool={tool} />)}
          </div>
        </section>

        <section className="rounded-2xl p-8 mb-16 border border-[hsl(43,60%,30%)]/30" style={{ background: 'linear-gradient(135deg, hsl(225,30%,10%), hsl(225,28%,8%))' }}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-heading gold-text font-bold mb-4">The Grudge Studio Advantage</h2>
            <p className="text-lg text-[hsl(45,15%,55%)] font-body">What makes our game development ecosystem unique</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Code, title: "No Coding Required", desc: "Visual interfaces make game dev accessible to everyone" },
              { icon: Zap, title: "Rapid Prototyping", desc: "Go from idea to playable game in hours, not months" },
              { icon: Users, title: "Community Support", desc: "Active communities and tutorials for every tool" },
              { icon: Shield, title: "Professional Quality", desc: "Industry-standard tools used by pro developers" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(43,85%,55%,0.1)', border: '1px solid hsl(43,60%,30%,0.3)' }}>
                  <item.icon className="w-8 h-8 text-[hsl(43,85%,55%)]" />
                </div>
                <h3 className="text-lg font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>{item.title}</h3>
                <p className="text-[hsl(45,15%,55%)] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center pb-8">
          <Link href="/">
            <Button className="gilded-button px-8 py-3 text-lg">
              Explore Our Platform
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
