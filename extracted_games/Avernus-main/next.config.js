const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for better performance
  experimental: {
    // Disable CSS optimization that requires critters module
    // optimizeCss: true,
    // Disable automatic package optimization to avoid conflicts with our custom barrel exports
    optimizePackageImports: ['@react-three/fiber', '@react-three/drei'],
  },
  
  // Optimize bundle splitting
  webpack: (config, { isServer }) => {
    // Optimize for Three.js
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    
    // Better tree shaking for Three.js and path aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      'three/examples/jsm': 'three/examples/jsm',
      '@': path.resolve(__dirname, 'src'),
      '@/core': path.resolve(__dirname, 'src/core'),
      '@/ecs': path.resolve(__dirname, 'src/ecs'),
      '@/systems': path.resolve(__dirname, 'src/systems'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@/contexts': path.resolve(__dirname, 'src/contexts'),
      '@/components': path.resolve(__dirname, 'src/components'),
    };
    
    // Optimize chunk splitting
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          three: {
            name: 'three',
            test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
            chunks: 'all',
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          gameSystems: {
            name: 'game-systems',
            test: /[\\/]src[\\/](systems|ecs|core)[\\/]/,
            chunks: 'all',
            priority: 25,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          gameComponents: {
            name: 'game-components',
            test: /[\\/]src[\\/]components[\\/]/,
            chunks: 'all',
            priority: 20,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 15,
            minChunks: 1,
            reuseExistingChunk: true,
          },
        },
      };
    }
    
    // Add bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(new BundleAnalyzerPlugin({
        analyzerPort: 8889,
        analyzerMode: 'static',
        openAnalyzer: false,
        generateStatsFile: true,
        statsFilename: 'bundle-stats.json'
      }))
    }
    
    return config;
  },
  
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    unoptimized: false,
  },

  // Add caching headers for audio files
  async headers() {
    return [
      {
        source: '/audio/sfx/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig