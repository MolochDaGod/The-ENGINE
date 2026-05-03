#!/usr/bin/env node
/**
 * Upload Toon Shooter GLB assets to Cloudflare R2
 * Uses the same R2 config as The-ENGINE .env
 * 
 * Usage: node upload-to-r2.mjs [--dry-run]
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load env from The-ENGINE
config({ path: 'F:/GitHub/Grudge-Studio-Game/Grudge-Studio-Game/The-ENGINE/.env' });

const isDryRun = process.argv.includes('--dry-run');
const GLB_ROOT = 'D:/Assets/ToonShooterKit/glb';
const R2_PREFIX = 'toon-shooter';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_KEY,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET,
  },
});

const BUCKET = process.env.R2_BUCKET_ASSETS || process.env.OBJECT_STORAGE_BUCKET || 'grudge-assets';
const MIME = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json' };

async function upload(localPath, key) {
  const ext = path.extname(localPath);
  const body = readFileSync(localPath);
  const size = (body.length / 1024).toFixed(1);

  if (isDryRun) {
    console.log(`  [DRY] ${key} (${size} KB)`);
    return;
  }

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: MIME[ext] || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log(`  ✓ ${key} (${size} KB)`);
  } catch (err) {
    console.error(`  ✗ ${key}: ${err.message}`);
  }
}

async function main() {
  console.log(`Uploading to R2 bucket: ${BUCKET}`);
  console.log(`Prefix: ${R2_PREFIX}/`);
  if (isDryRun) console.log('=== DRY RUN ===\n');

  let total = 0;

  for (const cat of ['characters', 'guns', 'environment']) {
    const dir = path.join(GLB_ROOT, cat);
    const files = readdirSync(dir).filter(f => f.endsWith('.glb'));
    console.log(`\n${cat.toUpperCase()} (${files.length} files):`);

    for (const file of files) {
      await upload(path.join(dir, file), `${R2_PREFIX}/${cat}/${file}`);
      total++;
    }
  }

  // Upload texture
  const texDir = path.join(GLB_ROOT, 'textures');
  try {
    const texFiles = readdirSync(texDir);
    if (texFiles.length) {
      console.log(`\nTEXTURES (${texFiles.length} files):`);
      for (const file of texFiles) {
        await upload(path.join(texDir, file), `${R2_PREFIX}/textures/${file}`);
        total++;
      }
    }
  } catch {}

  // Upload manifest
  await upload(path.join(GLB_ROOT, 'manifest.json'), `${R2_PREFIX}/manifest.json`);
  total++;

  console.log(`\n=== ${isDryRun ? 'Would upload' : 'Uploaded'} ${total} files ===`);
  console.log(`CDN URL: https://assets.grudge-studio.com/${R2_PREFIX}/`);
}

main().catch(console.error);
