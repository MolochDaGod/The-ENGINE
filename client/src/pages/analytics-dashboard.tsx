import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, TrendingUp, Users, Clock, Download, Star, BarChart3, Activity, Target, Globe } from "lucide-react";
import { Link } from "wouter";

interface ProjectMetrics {
  id: string;
  name: string;
  engine: string;
  linesOfCode: number;
  contributors: number;
  commits: number;
  buildTime: number;
  lastActivity: string;
  status: 'active' | 'completed' | 'paused';
  performance: {
    fps: number;
    memory: number;
    loadTime: number;
  };
  deployment: {
    platforms: string[];
    builds: number;
    downloads: number;
  };
}

interface EngineStats {
  engine: string;
  projects: number;
  activeUsers: number;
  totalBuilds: number;
  avgRating: number;
  marketShare: number;
}

interface GlobalMetrics {
  totalProjects: number;
  activeUsers: number;
  totalDownloads: number;
  platformDistribution: { platform: string; percentage: number }[];
  enginePopularity: { engine: string; usage: number }[];
  weeklyActivity: { day: string; projects: number; builds: number }[];
}

export default function AnalyticsDashboard() {
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics[]>([]);
  const [engineStats, setEngineStats] = useState<EngineStats[]>([]);
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    // Initialize project metrics data
    const projectData: ProjectMetrics[] = [
      {
        id: '1',
        name: 'Pixel Adventure RPG',
        engine: 'GDevelop',
        linesOfCode: 15420,
        contributors: 3,
        commits: 187,
        buildTime: 45,
        lastActivity: '2 hours ago',
        status: 'active',
        performance: {
          fps: 60,
          memory: 125,
          loadTime: 2.3
        },
        deployment: {
          platforms: ['Web', 'Android', 'iOS'],
          builds: 23,
          downloads: 1847
        }
      },
      {
        id: '2',
        name: 'Space Shooter 3D',
        engine: 'Buildbox',
        linesOfCode: 8940,
        contributors: 2,
        commits: 96,
        buildTime: 78,
        lastActivity: '1 day ago',
        status: 'active',
        performance: {
          fps: 55,
          memory: 245,
          loadTime: 4.1
        },
        deployment: {
          platforms: ['Android', 'iOS'],
          builds: 15,
          downloads: 892
        }
      },
      {
        id: '3',
        name: 'Tower Defense Pro',
        engine: 'Construct3',
        linesOfCode: 12680,
        contributors: 4,
        commits: 234,
        buildTime: 32,
        lastActivity: '3 hours ago',
        status: 'completed',
        performance: {
          fps: 58,
          memory: 89,
          loadTime: 1.8
        },
        deployment: {
          platforms: ['Web', 'Android'],
          builds: 31,
          downloads: 3421
        }
      },
      {
        id: '4',
        name: 'Crystal Quest RPG',
        engine: 'RPG Maker',
        linesOfCode: 23450,
        contributors: 1,
        commits: 156,
        buildTime: 124,
        lastActivity: '5 days ago',
        status: 'paused',
        performance: {
          fps: 30,
          memory: 312,
          loadTime: 8.7
        },
        deployment: {
          platforms: ['Windows', 'Mac'],
          builds: 8,
          downloads: 567
        }
      }
    ];

    setProjectMetrics(projectData);

    // Initialize engine statistics
    const engineData: EngineStats[] = [
      {
        engine: 'GDevelop',
        projects: 15,
        activeUsers: 234,
        totalBuilds: 156,
        avgRating: 4.7,
        marketShare: 28.5
      },
      {
        engine: 'Construct3',
        projects: 12,
        activeUsers: 189,
        totalBuilds: 98,
        avgRating: 4.6,
        marketShare: 22.8
      },
      {
        engine: 'Buildbox',
        projects: 8,
        activeUsers: 145,
        totalBuilds: 67,
        avgRating: 4.4,
        marketShare: 18.2
      },
      {
        engine: 'Stencyl',
        projects: 6,
        activeUsers: 98,
        totalBuilds: 45,
        avgRating: 4.3,
        marketShare: 12.1
      },
      {
        engine: 'RPG Maker',
        projects: 3,
        activeUsers: 67,
        totalBuilds: 23,
        avgRating: 4.5,
        marketShare: 8.9
      },
      {
        engine: 'Unity',
        projects: 4,
        activeUsers: 156,
        totalBuilds: 78,
        avgRating: 4.8,
        marketShare: 9.5
      }
    ];

    setEngineStats(engineData);

    // Initialize global metrics
    const globalData: GlobalMetrics = {
      totalProjects: 48,
      activeUsers: 889,
      totalDownloads: 15847,
      platformDistribution: [
        { platform: 'Web', percentage: 45.2 },
        { platform: 'Android', percentage: 28.7 },
        { platform: 'iOS', percentage: 16.8 },
        { platform: 'Windows', percentage: 6.1 },
        { platform: 'Mac', percentage: 3.2 }
      ],
      enginePopularity: [
        { engine: 'GDevelop', usage: 31.2 },
        { engine: 'Construct3', usage: 25.0 },
        { engine: 'Buildbox', usage: 16.7 },
        { engine: 'Unity', usage: 12.5 },
        { engine: 'Stencyl', usage: 8.3 },
        { engine: 'RPG Maker', usage: 6.3 }
      ],
      weeklyActivity: [
        { day: 'Mon', projects: 12, builds: 34 },
        { day: 'Tue', projects: 18, builds: 45 },
        { day: 'Wed', projects: 15, builds: 38 },
        { day: 'Thu', projects: 22, builds: 52 },
        { day: 'Fri', projects: 28, builds: 67 },
        { day: 'Sat', projects: 19, builds: 41 },
        { day: 'Sun', projects: 14, builds: 29 }
      ]
    };

    setGlobalMetrics(globalData);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'paused': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getPerformanceScore = (performance: ProjectMetrics['performance']) => {
    const fpsScore = Math.min(performance.fps / 60 * 100, 100);
    const memoryScore = Math.max(100 - (performance.memory / 500 * 100), 0);
    const loadScore = Math.max(100 - (performance.loadTime / 10 * 100), 0);
    return Math.round((fpsScore + memoryScore + loadScore) / 3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/engine-launcher">
            <Button variant="outline" className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Engine Launcher
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
              Analytics Dashboard
            </h1>
            <p className="text-gray-400">Comprehensive project and engine performance metrics</p>
          </div>
          
          <div className="flex space-x-2">
            {['7d', '30d', '90d'].map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(range as any)}
                className={timeRange === range 
                  ? "bg-orange-500 hover:bg-orange-600" 
                  : "border-gray-600 text-gray-300"
                }
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        {/* Global Metrics Overview */}
        {globalMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-orange-900/30 to-red-900/20 border-orange-500/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-400 text-sm font-medium">Total Projects</p>
                    <p className="text-3xl font-bold text-white">{globalMetrics.totalProjects}</p>
                  </div>
                  <Target className="w-8 h-8 text-orange-400" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                    <span className="text-green-400">+12% from last month</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border-blue-500/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-sm font-medium">Active Users</p>
                    <p className="text-3xl font-bold text-white">{globalMetrics.activeUsers.toLocaleString()}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                    <span className="text-green-400">+8% from last month</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-900/30 to-teal-900/20 border-green-500/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-sm font-medium">Total Downloads</p>
                    <p className="text-3xl font-bold text-white">{globalMetrics.totalDownloads.toLocaleString()}</p>
                  </div>
                  <Download className="w-8 h-8 text-green-400" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                    <span className="text-green-400">+23% from last month</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border-purple-500/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-400 text-sm font-medium">Avg Build Time</p>
                    <p className="text-3xl font-bold text-white">
                      {Math.round(projectMetrics.reduce((acc, p) => acc + p.buildTime, 0) / projectMetrics.length)}s
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-purple-400" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 text-red-400 mr-1" />
                    <span className="text-red-400">+5% from last month</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50 mb-8">
            <TabsTrigger value="projects" className="data-[state=active]:bg-orange-500">
              <Target className="w-4 h-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="engines" className="data-[state=active]:bg-orange-500">
              <BarChart3 className="w-4 h-4 mr-2" />
              Engines
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-orange-500">
              <Activity className="w-4 h-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="distribution" className="data-[state=active]:bg-orange-500">
              <Globe className="w-4 h-4 mr-2" />
              Distribution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Project Analytics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {projectMetrics.map((project) => (
                  <Card key={project.id} className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-white">{project.name}</CardTitle>
                          <p className="text-gray-400">{project.engine}</p>
                        </div>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Lines of Code</p>
                          <p className="text-white font-semibold">{project.linesOfCode.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Contributors</p>
                          <p className="text-white font-semibold">{project.contributors}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Commits</p>
                          <p className="text-white font-semibold">{project.commits}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Build Time</p>
                          <p className="text-white font-semibold">{project.buildTime}s</p>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Performance Score</span>
                          <span className="text-orange-400">{getPerformanceScore(project.performance)}%</span>
                        </div>
                        <Progress value={getPerformanceScore(project.performance)} className="h-2" />
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Last Activity: {project.lastActivity}</span>
                        <span className="text-green-400">{project.deployment.downloads} downloads</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="engines">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Engine Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {engineStats.map((engine) => (
                  <Card key={engine.engine} className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center justify-between">
                        {engine.engine}
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-orange-400 mr-1" />
                          <span className="text-orange-400">{engine.avgRating}</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Projects</p>
                          <p className="text-white font-semibold">{engine.projects}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Active Users</p>
                          <p className="text-white font-semibold">{engine.activeUsers}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Total Builds</p>
                          <p className="text-white font-semibold">{engine.totalBuilds}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Market Share</p>
                          <p className="text-white font-semibold">{engine.marketShare}%</p>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Market Share</span>
                          <span className="text-orange-400">{engine.marketShare}%</span>
                        </div>
                        <Progress value={engine.marketShare} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Performance Metrics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Performance Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {projectMetrics.map((project) => (
                        <div key={project.id} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-300">{project.name}</span>
                            <span className="text-orange-400">{getPerformanceScore(project.performance)}%</span>
                          </div>
                          <Progress value={getPerformanceScore(project.performance)} className="h-1" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Build Times</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {projectMetrics.map((project) => (
                        <div key={project.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-300">{project.name}</p>
                            <p className="text-sm text-gray-400">{project.engine}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-semibold">{project.buildTime}s</p>
                            <p className={`text-sm ${project.buildTime < 60 ? 'text-green-400' : project.buildTime < 120 ? 'text-orange-400' : 'text-red-400'}`}>
                              {project.buildTime < 60 ? 'Fast' : project.buildTime < 120 ? 'Average' : 'Slow'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="distribution">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Platform Distribution</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {globalMetrics && (
                  <>
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Platform Usage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {globalMetrics.platformDistribution.map((platform) => (
                            <div key={platform.platform} className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-300">{platform.platform}</span>
                                <span className="text-orange-400">{platform.percentage}%</span>
                              </div>
                              <Progress value={platform.percentage} className="h-2" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Engine Popularity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {globalMetrics.enginePopularity.map((engine) => (
                            <div key={engine.engine} className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-300">{engine.engine}</span>
                                <span className="text-orange-400">{engine.usage}%</span>
                              </div>
                              <Progress value={engine.usage} className="h-2" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}