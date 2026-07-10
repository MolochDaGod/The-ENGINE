import { Switch, Route, useLocation } from "wouter";
import type { ComponentType } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { AuthModalProvider } from "@/components/auth-modal";
import { GrudgePanelProvider, GrudgePanelTab } from "@/components/grudge-panel";
import Header from "@/components/header";
import Home from "@/pages/home";
import Login from "@/pages/login";
import AccountPage from "@/pages/account";
import LeaderboardsPage from "@/pages/leaderboards";
import PvpPage from "@/pages/pvp";
import AuthPopup from "@/pages/auth-popup";
import AuthCallback from "@/pages/auth-callback";
import CatalogPage from "@/pages/catalog";
import CloudPage from "@/pages/cloud";
import Scraping from "@/pages/scraping";
import Store from "@/pages/store";
import TowerDefense from "@/pages/tower-defense";
import TowerDefensePvP from "@/pages/tower-defense-pvp";
import Avernus3D from "@/pages/avernus-3d";
import RPGMakerStudio from "@/pages/rpg-maker-studio";
import Yahaha3DWorld from "@/pages/yahaha-3d-world";
import PuzzlePlatformer from "@/pages/puzzle-platformer";
import RealAssetBrowser from "@/pages/real-asset-browser";
import RealEngineManager from "@/pages/real-engine-manager";
import Advantage from "@/pages/advantage";
import SuperEngine from "@/pages/super-engine";
import GrudgeEditor from "@/pages/grudge-editor";
import EngineLauncher from "@/pages/engine-launcher";
import AssetStore from "@/pages/asset-store";
import CollaborationHub from "@/pages/collaboration-hub";
import AdvancedEngines from "@/pages/advanced-engines";
import AnalyticsDashboard from "@/pages/analytics-dashboard";
import DecaySurvival from "@/pages/decay-survival";
import Overdrive3D from "@/pages/overdrive-3d";
import AvernusArena from "@/pages/avernus-arena";
import Wargus from "@/pages/wargus";
import GameLibrary from "@/pages/game-library";
import GamePlayer from "@/pages/game-player";
import Chat from "@/pages/chat";
import AdminLogin from "@/pages/admin-login";
import NotFound from "@/pages/not-found";
import MageArena from "@/pages/mage-arena";
import AnnihilateDemo from "@/pages/annihilate-demo";
import GrudgeControllerDemo from "@/pages/grudge-controller-demo";
import WargusDefault from "@/pages/wargus-default";
import AssetPipeline from "@/pages/asset-pipeline";
import ComingSoon from "@/pages/coming-soon";
import CharacterViewerPage from "@/pages/character-viewer";
import CharacterRosterPage from "@/pages/character-roster";
import ConanInfoPage from "@/pages/conan-info";
import VoxelSandbox from "@/pages/voxel-sandbox";
import PolyFighter from "@/pages/polyfighter";
import TerraForge from "@/pages/terraforge";
import ForgeAccessPage from "@/pages/forge-access";
import GrudgeBrawl from "@/pages/grudge-brawl";
import AdminGuard from "@/components/admin-guard";
import AdminEntryButton from "@/components/admin-entry-button";
import { FleetConnectInit } from "@/components/fleet-connect-init";

const withAdminGuard = (Component: ComponentType) => {
  return function GuardedComponent() {
    return (
      <AdminGuard>
        <Component />
      </AdminGuard>
    );
  };
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/gs" component={Home} />
      <Route path="/home" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/account" component={AccountPage} />
      <Route path="/leaderboards" component={LeaderboardsPage} />
      <Route path="/pvp" component={PvpPage} />
      <Route path="/auth/popup" component={AuthPopup} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/catalog" component={CatalogPage} />
      <Route path="/cloud" component={CloudPage} />
      <Route path="/games" component={GameLibrary} />
      <Route path="/game-library" component={GameLibrary} />
      <Route path="/play/fleet/:id" component={GamePlayer} />
      <Route path="/play/:id" component={GamePlayer} />
      <Route path="/forge" component={ForgeAccessPage} />
      <Route path="/scraping" component={withAdminGuard(Scraping)} />
      <Route path="/store" component={Store} />
      <Route path="/tower-defense" component={TowerDefense} />
      <Route path="/tower-defense-pvp" component={TowerDefensePvP} />
      <Route path="/avernus-3d" component={Avernus3D} />
      <Route path="/rpg-maker-studio" component={RPGMakerStudio} />
      <Route path="/yahaha-3d-world" component={Yahaha3DWorld} />
      <Route path="/puzzle-platformer" component={PuzzlePlatformer} />
      <Route path="/real-asset-browser" component={withAdminGuard(RealAssetBrowser)} />
      <Route path="/real-engine-manager" component={withAdminGuard(RealEngineManager)} />
      <Route path="/advantage" component={Advantage} />
      <Route path="/super-engine" component={SuperEngine} />
      <Route path="/super-engine/:legacyId" component={SuperEngine} />
      <Route path="/grudge-editor" component={withAdminGuard(GrudgeEditor)} />
      <Route path="/engine-launcher" component={EngineLauncher} />
      <Route path="/asset-store" component={AssetStore} />
      <Route path="/collaboration-hub" component={withAdminGuard(CollaborationHub)} />
      <Route path="/advanced-engines" component={withAdminGuard(AdvancedEngines)} />
      <Route path="/analytics-dashboard" component={withAdminGuard(AnalyticsDashboard)} />
      <Route path="/decay-survival" component={DecaySurvival} />
      <Route path="/overdrive-racing" component={Overdrive3D} />
      <Route path="/overdrive-3d" component={Overdrive3D} />
      <Route path="/avernus-arena" component={AvernusArena} />
      <Route path="/wargus" component={Wargus} />
      <Route path="/default" component={WargusDefault} />
      <Route path="/chat" component={Chat} />
      <Route path="/mage-arena" component={MageArena} />
      <Route path="/annihilate-demo" component={AnnihilateDemo} />
      <Route path="/grudge-controller" component={GrudgeControllerDemo} />
      <Route path="/asset-pipeline" component={withAdminGuard(AssetPipeline)} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/voxel-sandbox" component={VoxelSandbox} />
      <Route path="/polyfighter" component={PolyFighter} />
      <Route path="/terraforge" component={TerraForge} />
      <Route path="/grudge-brawl" component={GrudgeBrawl} />
      <Route path="/viewer" component={CharacterViewerPage} />
      <Route path="/roster" component={CharacterRosterPage} />
      <Route path="/conan" component={ConanInfoPage} />
      <Route path="/starway-gruda" component={ComingSoon} />
      <Route path="/rts-star-armada" component={ComingSoon} />
      <Route path="/mech-armada" component={ComingSoon} />
      <Route path="/star-rts" component={ComingSoon} />
      <Route path="/survival" component={ComingSoon} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isViewerHost =
    hostname === "character.grudge-studio.com" ||
    hostname === "characters.grudge-studio.com" ||
    hostname === "grudge6.grudge-studio.com";
  const isConanHost =
    hostname === "conan.grudge-studio.com";
  const isViewerRoute =
    location === "/viewer" || location.startsWith("/viewer?") ||
    location === "/roster" || location.startsWith("/roster?") ||
    location === "/conan" || location.startsWith("/conan?");
  const isSuperEngineRoute =
    location === "/super-engine" ||
    location.startsWith("/super-engine?") ||
    location.startsWith("/super-engine/");
  const isForgeGameRoute =
    isSuperEngineRoute ||
    location === "/voxel-sandbox" || location.startsWith("/voxel-sandbox?") ||
    location === "/polyfighter" || location.startsWith("/polyfighter?") ||
    location === "/terraforge" || location.startsWith("/terraforge?") ||
    location === "/grudge-brawl" || location.startsWith("/grudge-brawl?") ||
    location === "/overdrive-racing" || location.startsWith("/overdrive-racing?") ||
    location === "/overdrive-3d" || location.startsWith("/overdrive-3d?") ||
    location === "/annihilate-demo" || location.startsWith("/annihilate-demo?") ||
    location === "/grudge-controller" || location.startsWith("/grudge-controller?");
  const isPortalEmbed =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      new URLSearchParams(window.location.search).get("embed") === "1");
  const minimalChrome = isViewerHost || isConanHost || isViewerRoute || isForgeGameRoute || isPortalEmbed;

  return (
    <TooltipProvider>
      <Toaster />
      {!minimalChrome && <Header />}
      <Router />
      {!minimalChrome && (
        <>
          <GrudgePanelTab />
          <AdminEntryButton />
        </>
      )}
      <FleetConnectInit />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthModalProvider>
          <GrudgePanelProvider>
            <AppShell />
          </GrudgePanelProvider>
        </AuthModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
