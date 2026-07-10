/**
 * Super-engine Grudge Fishing — 6-race select, Grudge6 locomotion,
 * fishing pole on right hand, skills 1/2/3 cast-reel-hook, Angeler fight systems.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Fish, Crosshair } from "lucide-react";
import { isPortalEmbedMode } from "@/lib/embed-mode";
import { GrudgeEngine } from "@/engine";
import {
  GrudgePlayerController,
  GRUDGE_CHARACTERS,
  type GrudgeCharacterEntry,
} from "@/engine/controller";
import {
  attachPoleToHand,
  createFishingPoleMesh,
  getPoleTipWorld,
} from "@/lib/fishing/fishingPole";
import {
  createArcLine,
  createBobber,
  createFishingLine,
  setLinePoints,
  updateArcLine,
} from "@/lib/fishing/castArc";
import {
  RODS,
  beginWaiting,
  createIdleFight,
  rarityColor,
  updateFight,
  type FightState,
  type RodStats,
} from "@/lib/fishing/anglerSystems";

type Phase = "select" | "play";
type CastMode = "free" | "aim" | "flying" | "in_water";

export default function GrudgeFishingPage() {
  const embedMode = isPortalEmbedMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<GrudgePlayerController | null>(null);
  const poleRef = useRef<THREE.Group | null>(null);
  const arcRef = useRef<THREE.Line | null>(null);
  const bobberRef = useRef<THREE.Mesh | null>(null);
  const lineRef = useRef<THREE.Line | null>(null);
  const waterRef = useRef<THREE.Mesh | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouseNdc = useRef(new THREE.Vector2());
  const keys = useRef(new Set<string>());
  const castMode = useRef<CastMode>("free");
  const fightRef = useRef<FightState>(createIdleFight());
  const aimPoint = useRef(new THREE.Vector3());
  const bobberVel = useRef(new THREE.Vector3());
  const castPower = useRef(0.65);
  const rodRef = useRef<RodStats>(RODS[0]);
  const waterY = 0.15;

  const [phase, setPhase] = useState<Phase>("select");
  const [raceId, setRaceId] = useState(GRUDGE_CHARACTERS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState({
    mode: "free" as CastMode,
    skillHint: "1 Aim cast · 2 Reel · 3 Hook",
    fight: createIdleFight(),
    score: 0,
  });

  const disposeScene = useCallback(() => {
    ctrlRef.current?.dispose();
    ctrlRef.current = null;
    poleRef.current = null;
    arcRef.current = null;
    bobberRef.current = null;
    lineRef.current = null;
    waterRef.current = null;
    GrudgeEngine.getInstance().destroy();
  }, []);

  const boot = useCallback(async (char: GrudgeCharacterEntry) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    setError(null);
    disposeScene();

    try {
      const engine = GrudgeEngine.getInstance();
      engine.init(canvas);

      // Ground (shore)
      engine.addGround(0x3d5c3a, 160);
      const ground = engine.scene.children.find(
        (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry,
      ) as THREE.Mesh | undefined;
      if (ground) {
        (ground.material as THREE.MeshStandardMaterial).color.setHex(0x3d5c3a);
      }

      // Water plane (fishing surface)
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 120),
        new THREE.MeshStandardMaterial({
          color: 0x1a6b8a,
          transparent: true,
          opacity: 0.72,
          roughness: 0.25,
          metalness: 0.15,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, waterY, -40);
      water.receiveShadow = true;
      water.name = "Water";
      engine.scene.add(water);
      waterRef.current = water;

      // Dock / shore markers
      const dock = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.4, 4),
        new THREE.MeshStandardMaterial({ color: 0x6b4423 }),
      );
      dock.position.set(0, 0.35, -2);
      dock.castShadow = true;
      engine.scene.add(dock);

      // Soft fog / sky tint
      engine.scene.background = new THREE.Color(0x87b5c9);
      engine.scene.fog = new THREE.Fog(0x87b5c9, 40, 140);

      const ctrl = new GrudgePlayerController();
      await ctrl.init({
        canvas,
        character: char,
        initPosition: new THREE.Vector3(0, 0.1, 2),
        staticCollider: ground,
        thirdMouseMode: 1,
        enableMobile: true,
      });
      ctrlRef.current = ctrl;

      // Fishing pole on right hand
      const model = ctrl.locomotion.getPlayerModel();
      const pole = createFishingPoleMesh();
      if (model) attachPoleToHand(model, pole);
      poleRef.current = pole;

      // Arc + bobber + line
      const arc = createArcLine();
      arc.visible = false;
      engine.scene.add(arc);
      arcRef.current = arc;

      const bobber = createBobber();
      engine.scene.add(bobber);
      bobberRef.current = bobber;

      const fline = createFishingLine();
      engine.scene.add(fline);
      lineRef.current = fline;

      castMode.current = "free";
      fightRef.current = createIdleFight();

      engine.start();
      setReady(true);
      setPhase("play");
      if (window.parent !== window) {
        window.parent.postMessage({ type: "grudge:game:ready", game: "grudge-fishing" }, "*");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fishing scene");
    } finally {
      setLoading(false);
    }
  }, [disposeScene]);

  // Input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === "Digit1" || e.code === "Numpad1") {
        if (castMode.current === "free" && fightRef.current.phase === "idle") {
          castMode.current = "aim";
          if (arcRef.current) arcRef.current.visible = true;
        }
      }
      if (e.code === "Escape" && castMode.current === "aim") {
        castMode.current = "free";
        if (arcRef.current) arcRef.current.visible = false;
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Mouse for aim + LMB cast
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== "play") return;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      // power from vertical mouse: higher on screen = more power
      castPower.current = Math.max(0.35, Math.min(1, 0.45 + (-mouseNdc.current.y + 1) * 0.35));
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (castMode.current !== "aim") return;
      // Launch bobber along arc
      const bobber = bobberRef.current;
      const pole = poleRef.current;
      if (!bobber || !pole) return;
      const tip = getPoleTipWorld(pole);
      bobber.position.copy(tip);
      bobber.visible = true;
      // Velocity toward aim with loft
      const dir = aimPoint.current.clone().sub(tip);
      const dist = dir.length();
      dir.normalize();
      const power = castPower.current;
      bobberVel.current.set(
        dir.x * dist * 1.1 * power,
        6 + power * 10,
        dir.z * dist * 1.1 * power,
      );
      castMode.current = "flying";
      if (arcRef.current) arcRef.current.visible = false;
      fightRef.current = createIdleFight();
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onClick);
    };
  }, [phase]);

  // Game loop extras (cast physics, fight, line)
  useEffect(() => {
    if (phase !== "play" || !ready) return;
    let raf = 0;
    let last = performance.now();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const engine = GrudgeEngine.getInstance();
      const camera = engine.camera;
      const pole = poleRef.current;
      const arc = arcRef.current;
      const bobber = bobberRef.current;
      const fline = lineRef.current;
      const water = waterRef.current;
      if (!camera || !pole) return;

      const tip = getPoleTipWorld(pole);

      // Aim: raycast to water plane
      if (castMode.current === "aim" && water) {
        raycaster.current.setFromCamera(mouseNdc.current, camera);
        const hits = raycaster.current.intersectObject(water);
        if (hits[0]) {
          aimPoint.current.copy(hits[0].point);
        } else {
          // fallback forward from player
          const pos = ctrlRef.current?.getPosition() ?? new THREE.Vector3();
          aimPoint.current.set(pos.x, waterY, pos.z - 18 * castPower.current);
        }
        // Clamp cast range
        const maxR = rodRef.current.castRange;
        const origin = tip.clone();
        const flat = aimPoint.current.clone();
        flat.y = waterY;
        const off = flat.clone().sub(new THREE.Vector3(origin.x, waterY, origin.z));
        if (off.length() > maxR) {
          off.setLength(maxR);
          flat.set(origin.x + off.x, waterY, origin.z + off.z);
          aimPoint.current.copy(flat);
        }
        if (arc) {
          arc.visible = true;
          updateArcLine(arc, tip, aimPoint.current, castPower.current);
        }
      }

      // Flying bobber
      if (castMode.current === "flying" && bobber) {
        bobberVel.current.y -= 18 * dt;
        bobber.position.addScaledVector(bobberVel.current, dt);
        if (bobber.position.y <= waterY + 0.05) {
          bobber.position.y = waterY + 0.08;
          bobberVel.current.set(0, 0, 0);
          castMode.current = "in_water";
          // depth from shore distance
          const shoreZ = 0;
          const depth01 = Math.min(1, Math.abs(bobber.position.z - shoreZ) / 50);
          beginWaiting(fightRef.current, depth01);
        }
      }

      // Bobber float idle
      if (castMode.current === "in_water" && bobber) {
        bobber.position.y = waterY + 0.08 + Math.sin(now / 400) * 0.03;
      }

      // Line tip → bobber
      if (fline && bobber?.visible) {
        setLinePoints(fline, tip, bobber.position);
        fline.visible = true;
      } else if (fline) {
        fline.visible = false;
      }

      // Skills while in water / fight
      const reeling = keys.current.has("Digit2") || keys.current.has("Numpad2");
      const hookPressed = keys.current.has("Digit3") || keys.current.has("Numpad3");

      if (castMode.current === "in_water") {
        // Empty reel returns bobber
        if (reeling && (fightRef.current.phase === "waiting" || fightRef.current.phase === "idle")) {
          if (bobber) {
            bobber.position.lerp(tip, Math.min(1, dt * 2.5 * rodRef.current.reelSpeedMult));
            if (bobber.position.distanceTo(tip) < 0.8) {
              bobber.visible = false;
              castMode.current = "free";
              fightRef.current = createIdleFight();
              fightRef.current.message = "Line reeled in.";
            }
          }
        }

        updateFight(fightRef.current, dt, {
          reeling,
          hookPressed,
          rod: rodRef.current,
          aimX: mouseNdc.current.x,
        });

        // Bite visual
        if (fightRef.current.phase === "bite" && bobber) {
          bobber.position.y = waterY - 0.05 + Math.sin(now / 60) * 0.12;
        }

        // End states reset to free
        if (
          fightRef.current.phase === "landed" ||
          fightRef.current.phase === "escaped" ||
          fightRef.current.phase === "snapped"
        ) {
          // brief hold then clear
          fightRef.current.biteTimer -= dt;
          if (fightRef.current.biteTimer < -2.2) {
            if (bobber) bobber.visible = false;
            castMode.current = "free";
            const score = fightRef.current.score;
            fightRef.current = createIdleFight();
            fightRef.current.score = score;
          }
        }
      }

      // HUD throttle
      setHud((h) => ({
        mode: castMode.current,
        skillHint:
          castMode.current === "aim"
            ? "Move mouse for arc · LMB cast · Esc cancel"
            : castMode.current === "in_water"
              ? "2 Reel · 3 Hook on bite"
              : "1 Aim cast · WASD move · Mouse look",
        fight: { ...fightRef.current },
        score: fightRef.current.score || h.score,
      }));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready]);

  useEffect(() => () => disposeScene(), [disposeScene]);

  const startWithRace = (id: string) => {
    setRaceId(id);
    const char = GRUDGE_CHARACTERS.find((c) => c.id === id) ?? GRUDGE_CHARACTERS[0];
    void boot(char);
  };

  // ── Race select ──
  if (phase === "select") {
    return (
      <div className={`${embedMode ? "h-screen" : "min-h-screen"} bg-[#0a1620] text-[#e8dfc8] flex flex-col`}>
        {!embedMode && (
          <header className="flex items-center gap-3 px-4 py-3 border-b border-[#1e3a4a]">
            <Link href="/super-engine">
              <Button variant="ghost" size="sm" className="text-[#38bdf8]">
                <ArrowLeft className="w-4 h-4 mr-1" /> Super Engine
              </Button>
            </Link>
            <Fish className="w-5 h-5 text-cyan-400" />
            <h1 className="font-semibold text-cyan-100">Grudge Fishing</h1>
          </header>
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center max-w-lg">
            <h2 className="text-2xl font-bold text-cyan-100 mb-2">Choose your race</h2>
            <p className="text-sm text-cyan-200/70">
              Grudge6 character loads on the dock with a fishing pole in the right hand. Skills:{" "}
              <strong>1</strong> cast arc · <strong>2</strong> reel · <strong>3</strong> hook — then Angeler fight
              systems.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-2xl">
            {GRUDGE_CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => startWithRace(c.id)}
                className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-4 text-left hover:border-cyan-400/70 hover:bg-cyan-900/40 transition-all"
                style={{ boxShadow: `inset 0 0 0 1px ${c.color}33` }}
              >
                <div className="text-lg font-semibold" style={{ color: c.color }}>
                  {c.name}
                </div>
                <div className="text-xs text-cyan-200/60 mt-1">{c.faction}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const f = hud.fight;

  return (
    <div className={`${embedMode ? "h-screen" : "min-h-screen"} bg-[#0a1620] text-[#e8dfc8] flex flex-col relative`}>
      {!embedMode && (
        <header className="flex items-center justify-between px-3 py-2 border-b border-[#1e3a4a] bg-[#0c1a24]/95 z-20 shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/super-engine">
              <Button variant="ghost" size="sm" className="text-cyan-400 h-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <span className="text-sm font-medium text-cyan-100">Grudge Fishing</span>
            <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-300">
              {GRUDGE_CHARACTERS.find((c) => c.id === raceId)?.name}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-200/70">Score {hud.score}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-cyan-500/40"
              onClick={() => {
                disposeScene();
                setPhase("select");
                setReady(false);
              }}
            >
              Change race
            </Button>
          </div>
        </header>
      )}

      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 text-cyan-200">
            Loading Grudge6 + dock…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-red-950/90 border border-red-500/40 rounded-lg p-4 text-sm text-red-200 max-w-md">
              {error}
            </div>
          </div>
        )}

        {/* Skill bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {[
            { k: "1", label: "Cast", active: hud.mode === "aim" },
            { k: "2", label: "Reel", active: false },
            { k: "3", label: "Hook", active: f.phase === "bite" },
          ].map((s) => (
            <div
              key={s.k}
              className={`px-3 py-2 rounded-lg border text-center min-w-[64px] ${
                s.active
                  ? "bg-cyan-500/30 border-cyan-300 text-white"
                  : "bg-black/70 border-cyan-500/30 text-cyan-100"
              }`}
            >
              <div className="text-lg font-bold">{s.k}</div>
              <div className="text-[10px] uppercase tracking-wide opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/65 border border-cyan-500/25 px-3 py-1.5 text-xs text-cyan-100">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          {hud.skillHint}
        </div>

        {/* Fight / tension HUD (Angeler-style) */}
        {(f.phase === "fighting" || f.phase === "bite" || f.phase === "waiting" || f.phase === "landed" || f.phase === "snapped" || f.phase === "escaped") && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-[min(420px,92vw)] rounded-xl bg-black/80 border border-cyan-500/30 p-3 space-y-2">
            <div className="text-xs text-cyan-100/90 text-center">{f.message}</div>
            {f.phase === "fighting" && f.fish && (
              <>
                <div className="flex justify-between text-[10px] text-cyan-200/70">
                  <span style={{ color: rarityColor(f.fish.rarity) }}>{f.fish.name}</span>
                  <span>{f.weight} lb · stamina {Math.round(f.fishStamina * 100)}%</span>
                </div>
                {/* Tension bar */}
                <div className="relative h-4 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/50 border-x border-emerald-300/60"
                    style={{
                      left: `${(f.zoneCenter - f.zoneWidth / 2) * 100}%`,
                      width: `${f.zoneWidth * 100}%`,
                    }}
                  />
                  <div
                    className="absolute top-0.5 bottom-0.5 w-1.5 rounded-full bg-amber-300 shadow"
                    style={{ left: `calc(${f.cursor * 100}% - 3px)` }}
                  />
                </div>
                <div className="flex gap-2 text-[10px]">
                  <div className="flex-1">
                    <div className="text-zinc-400 mb-0.5">Line stress</div>
                    <div className="h-1.5 rounded bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${Math.min(100, f.lineStress * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-zinc-400 mb-0.5">Fish stamina</div>
                    <div className="h-1.5 rounded bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: `${Math.max(0, f.fishStamina * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            {f.phase === "landed" && f.fish && (
              <div className="text-center text-sm font-semibold text-emerald-300">
                ✓ {f.fish.name} landed · +{f.fish.points} pts
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
