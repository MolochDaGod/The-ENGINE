import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Star, Download, Heart, Filter, Grid, List, ShoppingCart, Play } from "lucide-react";
import { Link } from "wouter";

interface Asset {
  id: string;
  name: string;
  category: string;
  type: 'template' | 'sprite' | 'audio' | '3d_model' | 'script' | 'ui_kit';
  price: number;
  rating: number;
  downloads: number;
  author: string;
  description: string;
  images: string[];
  tags: string[];
  fileSize: string;
  compatibility: string[];
  lastUpdated: string;
  featured: boolean;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  assets: Asset[];
  price: number;
  discount?: number;
}

export default function AssetStore() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cart, setCart] = useState<string[]>([]);

  useEffect(() => {
    const assetData: Asset[] = [
      {
        id: '1',
        name: 'Pixel Art Character Pack',
        category: '2D Assets',
        type: 'sprite',
        price: 15.99,
        rating: 4.8,
        downloads: 2847,
        author: 'PixelCraft Studio',
        description: 'Complete character pack with 8 animated characters, each with 4 directions and multiple animation states.',
        images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
        tags: ['pixel art', '2d', 'characters', 'animation'],
        fileSize: '25.4 MB',
        compatibility: ['Construct3', 'GDevelop', 'Stencyl', 'GameMaker'],
        lastUpdated: '2024-01-10',
        featured: true
      },
      {
        id: '2',
        name: 'Sci-Fi UI Complete',
        category: 'UI/UX',
        type: 'ui_kit',
        price: 29.99,
        rating: 4.9,
        downloads: 1523,
        author: 'FutureDesign Co',
        description: 'Comprehensive sci-fi UI kit with buttons, panels, HUD elements, and animated components.',
        images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
        tags: ['ui', 'sci-fi', 'hud', 'interface'],
        fileSize: '18.7 MB',
        compatibility: ['Unity', 'Construct3', 'Buildbox', 'GDevelop'],
        lastUpdated: '2024-01-15',
        featured: true
      },
      {
        id: '3',
        name: 'Epic Orchestral Soundtrack',
        category: 'Audio',
        type: 'audio',
        price: 39.99,
        rating: 4.7,
        downloads: 892,
        author: 'SoundScape Music',
        description: '20 high-quality orchestral tracks perfect for RPG and adventure games.',
        images: ['/api/placeholder/400/300'],
        tags: ['music', 'orchestral', 'rpg', 'soundtrack'],
        fileSize: '156.3 MB',
        compatibility: ['All Engines'],
        lastUpdated: '2024-01-08',
        featured: false
      },
      {
        id: '4',
        name: 'Medieval Castle 3D Kit',
        category: '3D Assets',
        type: '3d_model',
        price: 49.99,
        rating: 4.6,
        downloads: 634,
        author: '3D Fortress',
        description: 'Complete medieval castle environment with modular pieces, textures, and materials.',
        images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
        tags: ['3d', 'medieval', 'environment', 'castle'],
        fileSize: '89.2 MB',
        compatibility: ['Buildbox', 'Unity', 'Unreal', 'Yahaha'],
        lastUpdated: '2024-01-12',
        featured: true
      },
      {
        id: '5',
        name: 'Platformer Game Template',
        category: 'Templates',
        type: 'template',
        price: 24.99,
        rating: 4.8,
        downloads: 1847,
        author: 'GameDev Masters',
        description: 'Complete 2D platformer template with multiple levels, power-ups, and enemies.',
        images: ['/api/placeholder/400/300'],
        tags: ['template', 'platformer', '2d', 'complete'],
        fileSize: '45.1 MB',
        compatibility: ['Construct3', 'GDevelop', 'Stencyl'],
        lastUpdated: '2024-01-14',
        featured: true
      },
      {
        id: '6',
        name: 'AI Behavior Scripts',
        category: 'Code',
        type: 'script',
        price: 19.99,
        rating: 4.5,
        downloads: 456,
        author: 'CodeCraft AI',
        description: 'Advanced AI behavior scripts for NPCs, pathfinding, and decision making.',
        images: ['/api/placeholder/400/300'],
        tags: ['ai', 'scripts', 'npc', 'behavior'],
        fileSize: '3.2 MB',
        compatibility: ['GDevelop', 'Construct3', 'Custom Engines'],
        lastUpdated: '2024-01-11',
        featured: false
      }
    ];

    setAssets(assetData);

    fetch('/api/assets')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.assets.length > 0) {
          setAssets(data.assets);
        }
      })
      .catch(() => {});

    // Initialize collections
    const collectionData: Collection[] = [
      {
        id: '1',
        name: 'Indie Game Starter Bundle',
        description: 'Everything you need to start your indie game journey',
        assets: assetData.slice(0, 3),
        price: 69.99,
        discount: 30
      },
      {
        id: '2',
        name: 'Professional Game Assets',
        description: 'High-quality assets for commercial projects',
        assets: assetData.slice(3, 6),
        price: 99.99,
        discount: 25
      }
    ];

    setCollections(collectionData);
  }, []);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesPrice = priceFilter === 'all' || 
                        (priceFilter === 'free' && asset.price === 0) ||
                        (priceFilter === 'paid' && asset.price > 0);
    
    return matchesSearch && matchesCategory && matchesPrice;
  });

  const addToCart = (assetId: string) => {
    if (!cart.includes(assetId)) {
      setCart([...cart, assetId]);
    }
  };

  const removeFromCart = (assetId: string) => {
    setCart(cart.filter(id => id !== assetId));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/super-engine">
            <Button variant="outline" className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Super Engine
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
              Asset Store
            </h1>
            <p className="text-gray-400">Discover premium game assets and templates</p>
          </div>
          
          <Button className="bg-orange-500 hover:bg-orange-600 text-white relative">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Cart ({cart.length})
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="2D Assets">2D Assets</SelectItem>
              <SelectItem value="3D Assets">3D Assets</SelectItem>
              <SelectItem value="Audio">Audio</SelectItem>
              <SelectItem value="UI/UX">UI/UX</SelectItem>
              <SelectItem value="Templates">Templates</SelectItem>
              <SelectItem value="Code">Code</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="flex-1"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex-1"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 mb-8">
            <TabsTrigger value="assets" className="data-[state=active]:bg-orange-500">
              Featured Assets
            </TabsTrigger>
            <TabsTrigger value="collections" className="data-[state=active]:bg-orange-500">
              Collections
            </TabsTrigger>
            <TabsTrigger value="free" className="data-[state=active]:bg-orange-500">
              Free Assets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets">
            {/* Featured Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Featured Assets</h2>
              <div className={`grid gap-6 ${
                viewMode === 'grid' 
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                  : 'grid-cols-1'
              }`}>
                {filteredAssets.filter(asset => asset.featured).map((asset) => (
                  <Card key={asset.id} className="bg-gray-800/50 border-gray-700 hover:border-orange-500 transition-all duration-300 group">
                    {viewMode === 'grid' ? (
                      <>
                        <div className="relative overflow-hidden rounded-t-lg">
                          <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                            <div className="text-4xl opacity-50">
                              {asset.type === 'sprite' ? '🎨' :
                               asset.type === 'audio' ? '🎵' :
                               asset.type === '3d_model' ? '🏰' :
                               asset.type === 'ui_kit' ? '💻' :
                               asset.type === 'template' ? '🎮' : '📄'}
                            </div>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Button size="sm" variant="ghost" className="text-white hover:text-red-500">
                              <Heart className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                                {asset.name}
                              </h3>
                              <p className="text-sm text-gray-400">by {asset.author}</p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`w-3 h-3 ${
                                      i < Math.floor(asset.rating) 
                                        ? 'text-orange-400 fill-current' 
                                        : 'text-gray-400'
                                    }`} 
                                  />
                                ))}
                                <span className="text-sm text-gray-400 ml-1">({asset.downloads})</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                              {asset.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs border-gray-600 text-gray-400">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-orange-400">
                                ${asset.price}
                              </span>
                              <div className="flex space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black"
                                >
                                  <Play className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm"
                                  className="bg-orange-500 hover:bg-orange-600 text-white"
                                  onClick={() => addToCart(asset.id)}
                                  disabled={cart.includes(asset.id)}
                                >
                                  {cart.includes(asset.id) ? 'Added' : 'Add'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </>
                    ) : (
                      <CardContent className="p-4">
                        <div className="flex space-x-4">
                          <div className="w-24 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded flex items-center justify-center flex-shrink-0">
                            <div className="text-2xl opacity-50">
                              {asset.type === 'sprite' ? '🎨' :
                               asset.type === 'audio' ? '🎵' :
                               asset.type === '3d_model' ? '🏰' :
                               asset.type === 'ui_kit' ? '💻' :
                               asset.type === 'template' ? '🎮' : '📄'}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-white">{asset.name}</h3>
                                <p className="text-sm text-gray-400">by {asset.author}</p>
                                <p className="text-sm text-gray-300 mt-1">{asset.description}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-orange-400">${asset.price}</div>
                                <Button 
                                  size="sm"
                                  className="bg-orange-500 hover:bg-orange-600 text-white mt-2"
                                  onClick={() => addToCart(asset.id)}
                                  disabled={cart.includes(asset.id)}
                                >
                                  {cart.includes(asset.id) ? 'Added' : 'Add to Cart'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* All Assets */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">All Assets</h2>
              <div className={`grid gap-6 ${
                viewMode === 'grid' 
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                  : 'grid-cols-1'
              }`}>
                {filteredAssets.filter(asset => !asset.featured).map((asset) => (
                  <Card key={asset.id} className="bg-gray-800/50 border-gray-700 hover:border-orange-500 transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded flex items-center justify-center">
                          <div className="text-4xl opacity-50">
                            {asset.type === 'sprite' ? '🎨' :
                             asset.type === 'audio' ? '🎵' :
                             asset.type === '3d_model' ? '🏰' :
                             asset.type === 'ui_kit' ? '💻' :
                             asset.type === 'template' ? '🎮' : '📄'}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{asset.name}</h3>
                          <p className="text-sm text-gray-400">by {asset.author}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-orange-400">${asset.price}</span>
                          <Button 
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={() => addToCart(asset.id)}
                            disabled={cart.includes(asset.id)}
                          >
                            {cart.includes(asset.id) ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="collections">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {collections.map((collection) => (
                <Card key={collection.id} className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white">{collection.name}</CardTitle>
                        <p className="text-gray-400">{collection.description}</p>
                      </div>
                      {collection.discount && (
                        <Badge className="bg-red-500 text-white">
                          -{collection.discount}%
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        {collection.assets.slice(0, 3).map((asset) => (
                          <div key={asset.id} className="aspect-square bg-gray-700 rounded flex items-center justify-center">
                            <div className="text-2xl opacity-50">
                              {asset.type === 'sprite' ? '🎨' :
                               asset.type === 'audio' ? '🎵' :
                               asset.type === '3d_model' ? '🏰' :
                               asset.type === 'ui_kit' ? '💻' :
                               asset.type === 'template' ? '🎮' : '📄'}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold text-orange-400">
                            ${collection.price}
                          </div>
                          <div className="text-sm text-gray-400">
                            {collection.assets.length} assets included
                          </div>
                        </div>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                          <Download className="w-4 h-4 mr-2" />
                          Buy Collection
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="free">
            <div className="text-center py-16">
              <h2 className="text-2xl font-bold text-white mb-4">Free Assets Coming Soon</h2>
              <p className="text-gray-400 mb-8">
                We're preparing a collection of high-quality free assets for the community.
              </p>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Get Notified
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}