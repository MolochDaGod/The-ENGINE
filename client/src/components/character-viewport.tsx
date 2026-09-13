import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Loader2, RotateCcw, Swords, Footprints, Heart, Skull, Zap } from "lucide-react";
import { GrudgeAssets } from "@/lib/grudge-assets";
import { loadPortraitGlb, normalizePortraitModel } from "@/lib/portrait-glb-loader";
import { attachCosmetic, buildCosmeticMesh, removeCosmetics } from "@/lib/cosmetic-mesh";
import { getCosmeticById } from "@shared/cosmetics-roster";
import { getEquipmentMeshNames, type CharacterPrefab } from "@shared/character-prefabs";
import {
  portraitGlbUrl,
  resolvePrefabVisibleMeshes,
  resolveUnarmedVisibleMeshes,
} from "@shared/character-meshes";
import {
  applyMaterialPresetsToRoot,
  labelSceneMeshes,
  type MeshLabel,
} from "@shared/mesh-material-labels";

const ANIM_BTNS = [
  { id: "idle", label: "Idle", Icon: RotateCcw },
  { id: "run", label: "Run", Icon: Footprints },
  { id: "attack", label: "Attack", Icon: Swords },
  { id: "hurt", label: "Hit", Icon: Heart },
  { id: "death", label: "Death", Icon: Skull },
  { id: "attack2", label: "Alt", Icon: Zap },
] as const;

interface Props {
  prefab: CharacterPrefab;
  vfxMode?: boolean;
  /** Player preview — hide class weapons */
  unarmed?: boolean;
  /** Lane unit preview — show full prefab equipment (default for viewer) */
  laneMode?: boolean;
  /** CDN manifest keys for pregame weapon attach */
  weaponManifestKeys?: string[];
  /** Roster cosmetic: wings id */
  wingsId?: string | null;
  /** Roster cosmetic: cape id */
  capeId?: string | null;
  /** Tune metalness/roughness from mesh labels (keeps atlas maps) */
  applyMaterialLabels?: boolean;
  /** Report mesh labels after load (for roster inspector) */
  onMeshLabels?: (labels: MeshLabel[]) => void;
}

export default function CharacterViewport({
  prefab,
  vfxMode,
  unarmed,
  laneMode,
  weaponManifestKeys,
  wingsId,
  capeId,
  applyMaterialLabels = true,
  onMeshLabels,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const meshIndexRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const weaponRefs = useRef<THREE.Object3D[]>([]);
  const vfxRef = useRef<THREE.Points | null>(null);
  const rafRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyMeshVisibility = useCallback(() => {
    const idx = meshIndexRef.current;
    if (idx.size === 0) return;
    const names = Array.from(idx.keys());
    const visible = unarmed
      ? resolveUnarmedVisibleMeshes(names, prefab)
      : resolvePrefabVisibleMeshes(names, prefab);
    idx.forEach((obj, name) => {
      obj.visible = visible.has(name);
    });
  }, [prefab, unarmed]);

  const clearScene = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rootRef.current) {
      scene.remove(rootRef.current);
      rootRef.current.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      rootRef.current = null;
    }
    meshIndexRef.current.clear();
    for (const w of weaponRefs.current) scene.remove(w);
    weaponRefs.current = [];
    if (vfxRef.current) {
      scene.remove(vfxRef.current);
      vfxRef.current.geometry.dispose();
      (vfxRef.current.material as THREE.Material).dispose();
      vfxRef.current = null;
    }
  }, []);

  const spawnVfx = useCallback((scene: THREE.Scene, color: string) => {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 0.8 + Math.random() * 0.6;
      const theta = Math.random() * Math.PI * 2;
      const y = Math.random() * 1.8;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 0.06,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geom, mat);
    points.position.y = 0.2;
    scene.add(points);
    vfxRef.current = points;
  }, []);

  const loadCharacter = useCallback(async () => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    setLoading(true);
    setError(null);
    clearScene();

    try {
      const group = await loadPortraitGlb(prefab.race);
      // 1.8 m human scale, feet on y=0 (matches Open characterDeploy)
      normalizePortraitModel(group, 1.8);

      const idx = meshIndexRef.current;
      idx.clear();
      group.traverse((obj) => {
        // Index mesh / skinned pieces for wardrobe isolation
        if (
          obj.name &&
          ((obj as THREE.Mesh).isMesh || (obj as THREE.SkinnedMesh).isSkinnedMesh)
        ) {
          idx.set(obj.name, obj);
        }
      });
      applyMeshVisibility();
      // If visibility logic left nothing, force-show all meshes (bad name match)
      let anyVis = false;
      idx.forEach((obj) => {
        if (obj.visible) anyVis = true;
      });
      if (!anyVis && idx.size > 0) {
        idx.forEach((obj) => {
          obj.visible = true;
        });
      }

      // Mesh-level labels (skin / cloth / leather / metal) for edit tooling
      const labels = labelSceneMeshes(group);
      if (applyMaterialLabels) {
        applyMaterialPresetsToRoot(
          THREE as never,
          group as unknown as { traverse: (fn: (obj: Record<string, unknown>) => void) => void },
        );
      }
      onMeshLabels?.(labels);

      // Cosmetics: wings + cape (Unity lineage / procedural fallback)
      removeCosmetics(group);
      for (const cosId of [wingsId, capeId]) {
        if (!cosId) continue;
        const def = getCosmeticById(cosId);
        if (!def) continue;
        try {
          const node = await buildCosmeticMesh(def);
          attachCosmetic(group, node, def.attachBone);
        } catch {
          /* non-fatal */
        }
      }

      scene.add(group);
      rootRef.current = group;

      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(center.x + maxDim * 1.2, center.y + maxDim * 0.55, center.z + maxDim * 1.35);
      camera.lookAt(center);
      controlsRef.current?.target.copy(new THREE.Vector3(center.x, center.y + size.y * 0.45, center.z));
      controlsRef.current?.update();

      if (vfxMode) spawnVfx(scene, prefab.classColor);

      if (weaponManifestKeys?.length) {
        const assets = GrudgeAssets.getInstance();
        let offset = 0;
        for (const key of weaponManifestKeys) {
          const gltf = await assets.loadModel(key);
          if (!gltf) continue;
          const w = gltf.scene.clone();
          w.scale.setScalar(0.35);
          w.position.set(0.35 + offset * 0.15, 1.0, 0.1);
          scene.add(w);
          weaponRefs.current.push(w);
          offset += 1;
        }
      }

      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load character model");
      setLoading(false);
    }
  }, [
    prefab,
    vfxMode,
    weaponManifestKeys,
    wingsId,
    capeId,
    applyMaterialLabels,
    onMeshLabels,
    clearScene,
    spawnVfx,
    applyMeshVisibility,
  ]);

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 200);
    camera.position.set(2, 1.2, 2.5);

    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const maxDpr = mobile ? 1.5 : 2;
    const renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const grid = new THREE.GridHelper(6, 24, 0x3d3520, 0x1a1810);
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.DirectionalLight(0xffe8c8, 1.1);
    key.position.set(4, 6, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa8c8ff, 0.35);
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(new THREE.Color(prefab.classColor), 0.45);
    rim.position.set(0, 2, -3);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.9, 0);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    const onResize = () => {
      if (!hostRef.current) return;
      const w = hostRef.current.clientWidth;
      const h = hostRef.current.clientHeight;
      if (w < 1 || h < 1) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      controls.update();
      if (vfxRef.current) vfxRef.current.rotation.y += clockRef.current.getDelta() * 0.4;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      clearScene();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [clearScene, prefab.classColor]);

  useEffect(() => {
    void loadCharacter();
  }, [loadCharacter]);

  useEffect(() => {
    applyMeshVisibility();
  }, [applyMeshVisibility]);

  useEffect(() => {
    if (!vfxMode || !sceneRef.current || vfxRef.current) return;
    spawnVfx(sceneRef.current, prefab.classColor);
    return () => {
      if (vfxRef.current && sceneRef.current) {
        sceneRef.current.remove(vfxRef.current);
        vfxRef.current.geometry.dispose();
        (vfxRef.current.material as THREE.Material).dispose();
        vfxRef.current = null;
      }
    };
  }, [vfxMode, prefab.classColor, spawnVfx]);

  const equipment = getEquipmentMeshNames(prefab);
  const glbUrl = portraitGlbUrl(prefab.race);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-[hsl(43,60%,30%)]/30 bg-[hsl(225,25%,8%)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[hsl(43,60%,30%)]/20 shrink-0">
        <span className="text-sm font-heading text-[hsl(43,85%,55%)]">{prefab.name}</span>
        <span className="text-[10px] text-[hsl(45,15%,55%)]">
          {unarmed ? "unarmed" : prefab.animationPack}
          {laneMode ? " · lane" : ""}
          {" · toon-rts"}
        </span>
        {loading && <Loader2 size={12} className="animate-spin text-[hsl(43,85%,55%)] ml-auto" />}
      </div>
      <div className="flex-1 min-h-[280px] relative" ref={hostRef} />
      {error && (
        <div className="px-3 py-2 text-xs text-red-400 border-t border-red-900/30 bg-red-950/20">{error}</div>
      )}
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-[hsl(43,60%,30%)]/20 shrink-0 opacity-40 pointer-events-none" title="Static toon-rts portrait — animations coming with grudge6 locomotion pack">
        {ANIM_BTNS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            disabled
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[hsl(43,60%,30%)]/30 text-[hsl(45,15%,70%)]"
            title={label}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-1.5 text-[9px] text-[hsl(45,15%,50%)] border-t border-[hsl(43,60%,30%)]/10 shrink-0">
        <span>Faction {prefab.faction}</span>
        <span>·</span>
        <span>{equipment.length} wardrobe slots</span>
        <span>·</span>
        <span className="truncate max-w-[200px] font-mono">{glbUrl.split("/").pop()}</span>
        {weaponManifestKeys && weaponManifestKeys.length > 0 && (
          <>
            <span>·</span>
            <span className="text-[hsl(43,85%,55%)]">{weaponManifestKeys.length} pregame weapon(s)</span>
          </>
        )}
        {vfxMode && (
          <>
            <span>·</span>
            <span className="text-[hsl(43,85%,55%)]">VFX aura active</span>
          </>
        )}
      </div>
    </div>
  );
}