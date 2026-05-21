import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { requestPopupToken } from "@/lib/player-auth";

const CLOUD_URL = "https://grudgecloud.puter.site/";
const CLOUD_ORIGIN = "https://grudgecloud.puter.site";

export default function CloudPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { player } = useAuth();
  const [iframeReady, setIframeReady] = useState(false);

  // When the iframe loads and a player is signed in, mint a 5-min launch token
  // and postMessage the identity to the Puter cloud app. The cloud app listens
  // for `{ type: "grudge:identity", grudgeId, username, displayName, token }`
  // on trusted origins (grudge-studio.com is hard-coded in its allowlist) and
  // persists the Puter ↔ Grudge ID link so it recognizes this user on its own
  // origin from that point forward.
  useEffect(() => {
    if (!iframeReady || !player || !iframeRef.current) return;
    (async () => {
      const mint = await requestPopupToken(window.location.origin);
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "grudge:identity",
          grudgeId: player.grudgeId,
          username: player.username,
          displayName: player.displayName,
          role: player.role,
          token: mint.ok ? mint.data.token : null,
        },
        CLOUD_ORIGIN,
      );
    })();
  }, [iframeReady, player]);

  // Re-send identity when the cloud app announces it's ready (helps if the
  // iframe loads before the postMessage listener is attached).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== CLOUD_ORIGIN) return;
      if (!event.data || event.data.type !== "grudge:cloud:ready") return;
      if (!player || !iframeRef.current) return;
      (async () => {
        const mint = await requestPopupToken(window.location.origin);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "grudge:identity",
            grudgeId: player.grudgeId,
            username: player.username,
            displayName: player.displayName,
            role: player.role,
            token: mint.ok ? mint.data.token : null,
          },
          CLOUD_ORIGIN,
        );
      })();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [player]);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(225,30%,6%)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(43,60%,30%)]/30 bg-[hsl(225,30%,8%)]">
        <div>
          <div className="text-xs uppercase tracking-widest text-[hsl(43,85%,55%)] font-heading">My Grudge Cloud</div>
          <div className="text-[11px] text-[hsl(45,15%,60%)] font-body">Personal Puter cloud · synced with your Grudge ID</div>
        </div>
        <a href={CLOUD_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]">
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open in new tab
          </Button>
        </a>
      </div>
      <div className="relative flex-1">
        {!iframeReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={CLOUD_URL}
          title="My Grudge Cloud"
          className="w-full h-full border-0"
          onLoad={() => setIframeReady(true)}
          allow="clipboard-read; clipboard-write"
          referrerPolicy="origin-when-cross-origin"
          style={{ minHeight: "calc(100vh - 64px)" }}
        />
      </div>
    </div>
  );
}
  }
  createLoadingManager() {
    const loadingManager = new THREE.LoadingManager();

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = (itemsLoaded / itemsTotal) * 100;
      this.loadingScreen.updateProgress(progress);
    };

    loadingManager.onLoad = () => {
      this.init();
    };

    loadingManager.onError = (url) => console.error(`Error loading ${url} - Game.js:111`);

    return loadingManager;
  }
  setupLights() {
    this.lights.directional.castShadow = true;
    this.lights.directional.target = this.player.model;
    this.lights.directional.shadow.mapSize.width = 2048;
    this.lights.directional.shadow.mapSize.height = 2048;
    this.lights.directional.shadow.camera.near = 0.1;
    this.lights.directional.shadow.camera.far = 100;
    this.lights.directional.shadow.camera.left = -20;
    this.lights.directional.shadow.camera.right = 20;
    this.lights.directional.shadow.camera.top = 20;
    this.lights.directional.shadow.camera.bottom = -20;

    this.scene.add(this.lights.ambient, this.lights.directional);
  }
  setupPostProcessing() {
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const renderPass = new RenderPass(this.scene, this.camera.camera);
    this.composer.addPass(renderPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms["resolution"].value.set(
      1 / window.innerWidth,
      1 / window.innerHeight
    );
    this.composer.addPass(fxaaPass);

    this.glitchPass = new GlitchPass();
    this.glitchPass.goWild = true;
    this.glitchPass.enabled = false;
    this.composer.addPass(this.glitchPass);

    this.composer.addPass(this.camera.motionBlurPass);
  }
  resize() {
    this.camera.resize();
    this.rearviewMirror.resize();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
  addListeners() {
    window.addEventListener("resize", () => this.resize());

    setTimeout(() => this.pauseScreen.addListeners(), 5000);
  }
  render() {
    this.composer.render();
  }
  updateUI() {
    this.speedometer.update();
    this.tachometer.update();
    this.damageMeter.update();
    this.rearviewMirror.update();

    this.controlsScreen.update();
  }
  updateLights() {
    this.lights.directional.position.copy(
      new THREE.Vector3(
        this.player.physics.position.x + 7,
        this.player.physics.position.y + 75,
        this.player.physics.position.z + 25
      )
    );
  }
  checkGameOver() {
    if (this.player.health <= 0) {
      this.gameOver = true;
      this.startDeathSequence();
    }
  }
  update() {
    if (!this.gameOver && !this.paused) {
      const delta = this.clock.getDelta() * 1000;

      this.checkGameOver();
      this.world.step(this.timeStep);
      this.camera.update(delta);
      this.player.update(delta);
      this.ground.update();
      this.obstacleManager.update();
      this.updateLights();
      this.updateUI();
    }

    this.render();
  }
  showUI() {
    this.speedometer.show();
    this.tachometer.show();
    this.damageMeter.show();
    this.rearviewMirror.show();
  }
  hideUI() {
    this.speedometer.hide();
    this.tachometer.hide();
    this.damageMeter.hide();
    this.rearviewMirror.hide();
  }
  startDeathSequence() {
    this.hideUI();
    this.glitchPass.enabled = true;

    const distance = this.player.physics.position.clone().normalize() * 3;
    const topSpeed = this.speedometer.topSpeed;
    const obstaclesDodged = Math.floor(this.obstacleManager.dodged * 0.05);

    this.deathScreen.updateStats(distance, topSpeed, obstaclesDodged);
    this.deathScreen.show();
  }
}