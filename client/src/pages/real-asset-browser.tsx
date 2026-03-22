import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft,
  Search,
  Download,
  FileText,
  Image,
  Music,
  Archive,
  Code,
  Settings,
  FolderOpen,
  Eye,
  Maximize2
} from "lucide-react";
import { Link } from "wouter";

interface RealAsset {
  id: string;
  name: string;
  type: string;
  path: string;
  size: string;
  uploaded: string;
  description?: string;
}

export default function RealAssetBrowser() {
  const [assets, setAssets] = useState<RealAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch real assets from file system
    fetch('/api/assets')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setAssets(data.assets);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to fetch assets:', error);
        setLoading(false);
      });
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleAssetHover = (asset: RealAsset) => {
    setHoveredAsset(asset.id);
    if (asset.type === 'png' || asset.type === 'jpg' || asset.type === 'jpeg') {
      // For real image assets, we'll show a preview
      setPreviewImage(`/api/assets/preview/${asset.id}`);
    } else {
      setPreviewImage(null);
    }
  };

  const handleAssetLeave = () => {
    setHoveredAsset(null);
    setPreviewImage(null);
  };

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <Image className="w-6 h-6 text-blue-400" />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <Music className="w-6 h-6 text-green-400" />;
      case 'txt':
      case 'md':
      case 'json':
        return <FileText className="w-6 h-6 text-yellow-400" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive className="w-6 h-6 text-purple-400" />;
      case 'exe':
      case 'bat':
      case 'desktop':
        return <Settings className="w-6 h-6 text-red-400" />;
      case 'js':
      case 'ts':
      case 'xml':
        return <Code className="w-6 h-6 text-orange-400" />;
      default:
        return <FileText className="w-6 h-6 text-gray-400" />;
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || asset.type.toLowerCase() === selectedType.toLowerCase();
    return matchesSearch && matchesType;
  });

  const uniqueTypes = ['all', ...Array.from(new Set(assets.map(asset => asset.type)))];

  const downloadAsset = (asset: RealAsset) => {
    // Create download link for real asset
    const link = document.createElement('a');
    link.href = `/api/assets/download/${asset.id}`;
    link.download = `${asset.name}.${asset.type}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/super-engine">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Super Engine
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Real Asset Browser
              </h1>
              <p className="text-gray-400">Browse and manage authentic project assets from file system</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className="bg-blue-500/20 text-blue-400">
              <FolderOpen className="w-3 h-3 mr-1" />
              {assets.length} Files
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search assets by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 rounded-md bg-gray-800 border border-gray-700 text-white"
          >
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Asset Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Scanning file system...</div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-400">No assets found matching your criteria</div>
          </div>
        ) : (
          <div 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative"
          >
            {filteredAssets.map((asset) => (
              <Card 
                key={asset.id} 
                className={`bg-gray-800/50 border-gray-700 transition-all duration-300 cursor-pointer relative overflow-hidden ${
                  hoveredAsset === asset.id 
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20 transform scale-105 bg-gray-700/80' 
                    : 'hover:bg-gray-700/50 hover:border-blue-400'
                }`}
                onMouseEnter={() => handleAssetHover(asset)}
                onMouseLeave={handleAssetLeave}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(asset.type)}
                      {(asset.type === 'png' || asset.type === 'jpg' || asset.type === 'jpeg') && hoveredAsset === asset.id && (
                        <Eye className="w-4 h-4 text-blue-400 animate-pulse" />
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs transition-colors duration-300 ${
                        hoveredAsset === asset.id 
                          ? 'border-blue-500 text-blue-400' 
                          : 'border-gray-600 text-gray-300'
                      }`}
                    >
                      {asset.type.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className={`font-semibold mb-2 truncate transition-colors duration-300 ${
                    hoveredAsset === asset.id ? 'text-blue-300' : 'text-white'
                  }`} title={asset.name}>
                    {asset.name}
                  </h3>
                  
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className={`transition-colors duration-300 ${
                      hoveredAsset === asset.id ? 'text-blue-400' : ''
                    }`}>Size: {asset.size}</div>
                    <div className="truncate">Path: {asset.path}</div>
                    <div>Modified: {new Date(asset.uploaded).toLocaleDateString()}</div>
                    {asset.description && (
                      <div className="text-xs text-gray-500 italic">
                        {asset.description}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <Button
                      onClick={() => downloadAsset(asset)}
                      className={`w-full transition-all duration-300 ${
                        hoveredAsset === asset.id 
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/30' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      } text-white`}
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    
                    <Button
                      variant="outline"
                      className={`w-full transition-all duration-300 ${
                        hoveredAsset === asset.id 
                          ? 'border-blue-500 text-blue-400 hover:bg-blue-500/10' 
                          : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      }`}
                      size="sm"
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Show in Folder
                    </Button>
                  </div>
                  
                  {hoveredAsset === asset.id && (
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 pointer-events-none animate-pulse" />
                  )}
                </CardContent>
              </Card>
            ))}
            
            {/* Floating Preview for Images */}
            {previewImage && hoveredAsset && (
              <div 
                className="fixed z-50 pointer-events-none transition-all duration-200 ease-out"
                style={{
                  left: Math.min(mousePosition.x + 20, window.innerWidth - 220),
                  top: Math.max(mousePosition.y - 120, 20),
                }}
              >
                <div className="bg-gray-900/95 border border-blue-500 rounded-lg p-3 shadow-2xl shadow-blue-500/40 backdrop-blur-sm">
                  <img 
                    src={previewImage} 
                    alt="Asset preview"
                    className="max-w-48 max-h-48 object-contain rounded border border-gray-700"
                    onError={() => setPreviewImage(null)}
                  />
                  <div className="mt-2 text-xs text-blue-400 text-center flex items-center justify-center">
                    <Maximize2 className="w-3 h-3 mr-1" />
                    Interactive Preview
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Asset Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{assets.length}</div>
              <div className="text-gray-400 text-sm">Total Assets</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {assets.filter(a => ['png', 'jpg', 'jpeg', 'gif'].includes(a.type.toLowerCase())).length}
              </div>
              <div className="text-gray-400 text-sm">Images</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">
                {assets.filter(a => ['exe', 'bat', 'desktop'].includes(a.type.toLowerCase())).length}
              </div>
              <div className="text-gray-400 text-sm">Executables</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {assets.filter(a => ['txt', 'json', 'xml', 'md'].includes(a.type.toLowerCase())).length}
              </div>
              <div className="text-gray-400 text-sm">Documents</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}