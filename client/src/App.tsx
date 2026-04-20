import { Switch, Route } from "wouter";
import type { ComponentType } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { AuthModalProvider } from "@/components/auth-modal";
import Header from "@/components/header";
import Home from "@/pages/home";
import Login from "@/pages/login";
import AccountPage from "@/pages/account";
import LeaderboardsPage from "@/pages/leaderboards";
import PvpPage from "@/pages/pvp";
import Scraping from "@/pages/scraping";
import Store from "@/pages/store";
import TowerDefense from "@/pages/tower-defense";
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
import OverdriveRacing from "@/pages/overdrive-racing";
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
import AdminGuard from "@/components/admin-guard";
import AdminEntryButton from "@/components/admin-entry-button";

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
      <Route path="/login" component={Login} />
      <Route path="/account" component={AccountPage} />
      <Route path="/leaderboards" component={LeaderboardsPage} />
      <Route path="/pvp" component={PvpPage} />
      <Route path="/games" component={GameLibrary} />
      <Route path="/game-library" component={GameLibrary} />
      <Route path="/play/:id" component={GamePlayer} />
      <Route path="/scraping" component={withAdminGuard(Scraping)} />
      <Route path="/store" component={Store} />
      <Route path="/tower-defense" component={TowerDefense} />
      <Route path="/avernus-3d" component={Avernus3D} />
      <Route path="/rpg-maker-studio" component={RPGMakerStudio} />
      <Route path="/yahaha-3d-world" component={Yahaha3DWorld} />
      <Route path="/puzzle-platformer" component={PuzzlePlatformer} />
      <Route path="/real-asset-browser" component={withAdminGuard(RealAssetBrowser)} />
      <Route path="/real-engine-manager" component={withAdminGuard(RealEngineManager)} />
      <Route path="/advantage" component={Advantage} />
      <Route path="/super-engine" component={SuperEngine} />
      <Route path="/grudge-editor" component={withAdminGuard(GrudgeEditor)} />
      <Route path="/engine-launcher" component={EngineLauncher} />
      <Route path="/asset-store" component={AssetStore} />
      <Route path="/collaboration-hub" component={withAdminGuard(CollaborationHub)} />
      <Route path="/advanced-engines" component={withAdminGuard(AdvancedEngines)} />
      <Route path="/analytics-dashboard" component={withAdminGuard(AnalyticsDashboard)} />
      <Route path="/decay-survival" component={DecaySurvival} />
      <Route path="/overdrive-racing" component={OverdriveRacing} />
      <Route path="/overdrive-3d" component={Overdrive3D} />
      <Route path="/avernus-arena" component={AvernusArena} />
      <Route path="/wargus" component={Wargus} />
      <Route path="/chat" component={Chat} />
      <Route path="/mage-arena" component={MageArena} />
      <Route path="/annihilate-demo" component={AnnihilateDemo} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthModalProvider>
          <TooltipProvider>
            <Toaster />
            <Header />
            <Router />
            <AdminEntryButton />
          </TooltipProvider>
        </AuthModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
