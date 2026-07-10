import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Loader2 } from "lucide-react";
import type { CharacterPrefab } from "@shared/character-prefabs";
import { portraitGlbUrl, resolvePrefabVisibleMeshes } from "@shared/character-meshes";

const glbCache = new Map<string, Promise<THREE.Group>>();

function loadGlb(url: string): Promise<THREE.Group> {
  let p = glbCache.get(url);
  if (!p) {
    p = new Promise<THREE.Group>((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err),
      );
    });
    glbCache.set(url, p);
  }
  return p.then((scene) => scene.clone(true));
}

interface Props {
  prefab: CharacterPrefab;
  className?: string;
}

export function PrefabModelPreview({ prefab, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const meshIndexRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyVisibility = useCallback(() => {
    const idx = meshIndexRef.current;
    if (idx.size === 0) return;
    const visible = resolvePrefabVisibleMeshes(Array.from(idx.keys()), prefab);
    idx.forEach((obj, name) => {
      obj.visible = visible.has(name);
    });
  }, [prefab]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0908);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.35, 3.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.DirectionalLight(0xffe9c0, 1.0);
    key.position.set(2, 3, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(prefab.classColor), 0.55);
    rim.position.set(-2, 1.5, -2);
    scene.add(rim);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight || 280;
      if (w < 1 || h < 1) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    let raf = 0;
    let rot = 0;
    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      rot += 0.004;
      if (rootRef.current) rootRef.current.rotation.y = rot;
      controls.update();
      renderer.render(scene, camera);
    };

    const installModel = (group: THREE.Group) => {
      if (disposed) return;
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const scale = 2.0 / Math.max(size.y, 0.001);
      group.scale.setScalar(scale);
      group.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);

      const idx = meshIndexRef.current;
      idx.clear();
      group.traverse((obj) => {
        if (obj.name) idx.set(obj.name, obj);
      });

      rootRef.current = group;
      scene.add(group);
      applyVisibility();
      setLoading(false);
      tick();
    };

    setLoading(true);
    setError(null);

    const url = portraitGlbUrl(prefab.race);
    loadGlb(url)
      .then(installModel)
      .catch((e) => {
        if (disposed) return;
        setError(e instanceof Error ? e.message : "Failed to load character model");
        setLoading(false);
      });

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
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
      pmrem.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [prefab.id, prefab.race, prefab.classColor, applyVisibility]);

  useEffect(() => {
    applyVisibility();
  }, [applyVisibility]);

  return (
    <div
      ref={hostRef}
      className={className ?? "relative w-full aspect-[4/3] rounded-lg border border-[hsl(43,60%,30%)]/30 overflow-hidden bg-[#0d0908]"}
    >
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