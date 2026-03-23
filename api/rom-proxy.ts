// Vercel Edge Function — streams ROM binary from rec0ded88.com.
// Edge runtime handles large files without the 4.5MB serverless body limit.
export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://rec0ded88.com/',
  'https://cdn.emulatorjs.org/',
];

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowed = ALLOWED_ORIGINS.some(origin => url.startsWith(origin));
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'URL not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Grudge-Studio-Proxy/1.0)' },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `ROM not found (HTTP ${upstream.status})` }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch ROM' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
