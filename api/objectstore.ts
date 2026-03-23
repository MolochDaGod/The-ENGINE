/**
 * GET /api/objectstore?path=/v1/assets&...
 *
 * Transparent read-through proxy to objectstore.grudge-studio.com (Cloudflare R2 Worker).
 * Lets the frontend query assets, list by category, or download files without
 * cross-origin issues. Write operations (upload/delete) are NOT proxied — those
 * go directly to objectstore.grudge-studio.com with the API key from a server context.
 *
 * Examples:
 *   /api/objectstore?path=/v1/assets&category=icon
 *   /api/objectstore?path=/v1/assets/some-uuid
 *   /api/objectstore?path=/v1/assets/some-uuid/file  → binary stream
 *   /api/objectstore?path=/health
 */
export const config = { runtime: 'edge' };

const OBJECTSTORE_BASE = 'https://objectstore.grudge-studio.com';

// Paths allowed for unauthenticated read proxying
const ALLOWED_PREFIXES = ['/v1/assets', '/v1/models', '/health'];

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') ?? '';

  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing ?path= parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only allow GET reads, not writes
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Only GET is allowed via this proxy' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Guard: only allow whitelisted paths
  const allowed = ALLOWED_PREFIXES.some(p => path.startsWith(p));
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Path not allowed via proxy' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward remaining query params (category, tag, q, limit, offset, etc.)
  const fwd = new URL(`${OBJECTSTORE_BASE}${path}`);
  searchParams.forEach((v, k) => {
    if (k !== 'path') fwd.searchParams.set(k, v);
  });

  try {
    const upstream = await fetch(fwd.toString(), {
      method: 'GET',
      headers: { Accept: req.headers.get('Accept') || '*/*' },
    });

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=300';

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'objectstore unreachable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
