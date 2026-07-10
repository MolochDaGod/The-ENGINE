import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Loader2 } from "lucide-react";
import { normalizeWeaponMaterials, resolveWeaponTextures } from "@/lib/resolve-weapon-textures";
import { applyWeaponTierEffects, type TierEffectHandles } from "@/lib/weapon-tier-effects";

interface Props {
  modelUrl: string;
  tier?: number;
  tierColor?: string;
  tierLabel?: string;
  className?: string;
}

export function ItemModelPreview({ modelUrl, tier = 1, tierColor, tierLabel, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !modelUrl) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0908);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(1.2, 0.9, 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = tier >= 4;
    controls.autoRotateSpeed = 0.8;
    controls.target.set(0, 0.4, 0);

    const hemi = new THREE.HemisphereLight(0xfff0d0, 0x1a1208, 0.65);
    const key = new THREE.DirectionalLight(0xffe8c0, 1.35);
    key.position.set(2, 4, 3);
    const fill = new THREE.DirectionalLight(0xa8c8ff, 0.4);
    fill.position.set(-2, 1, -1);
    const rim = new THREE.DirectionalLight(tierColor ? new THREE.Color(tierColor) : 0xd4af37, tier >= 3 ? 0.55 : 0.25);
    rim.position.set(0, 2, -3);
    scene.add(hemi, key, fill, rim);

    let model: THREE.Object3D | null = null;
    let tierFx: TierEffectHandles | null = null;
    let alive = true;
    const clock = new THREE.Clock();
    let raf = 0;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight || 220;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      tierFx?.update(elapsed);
      controls.update();
      renderer.render(scene, camera);
    };

    resize();
    animate();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    setLoading(true);
    setError(null);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      async (gltf) => {
        if (!alive) return;
        model = gltf.scene;

        normalizeWeaponMaterials(model);
        await resolveWeaponTextures(model, modelUrl);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 1.2 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        model.position.y += size.y * scale * 0.5;

        tierFx = applyWeaponTierEffects(model, tier, tierColor);
        scene.add(model);
        setLoading(false);
      },
      undefined,
      (err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load model");
        setLoading(false);
      },
    );

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      tierFx?.dispose();
      if (model) {
        scene.remove(model);
        model.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => m?.dispose());
          }
        });
      }
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      controls.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [modelUrl, tier, tierColor]);

  return (
    <div
      ref={hostRef}
      className={
        className ??
        "relative w-full h-[220px] rounded-lg border overflow-hidden bg-[#0d0908]"
      }
      style={{
        borderColor: tierColor ? `${tierColor}55` : "hsl(43,60%,30%,0.3)",
        boxShadow: tier >= 4 && tierColor ? `0 0 24px ${tierColor}22, inset 0 0 40px ${tierColor}08` : undefined,
      }}
    >
      {tierLabel && tier >= 3 && (
        <div
          className="absolute top-2 left-2 z-10 text-[9px] px-1.5 py-0.5 rounded border backdrop-blur-sm font-medium uppercase tracking-wider"
          style={{
            color: tierColor,
            borderColor: `${tierColor}66`,
            background: `${tierColor}18`,
          }}
        >
          {tierLabel}
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[hsl(43,85%,55%)] z-10">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-[hsl(0,60%,55%)] px-3 text-center z-10">
          {error}
        </div>
      )}
    </div>
  );
}