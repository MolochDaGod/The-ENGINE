/**
 * Voxgrudge same-origin embed proxy (TerraForge / Voxel Sandbox / Grudge Brawl).
 *
 * Why: direct grudox URLs send X-Frame-Options: SAMEORIGIN. A plain Vercel
 * rewrite also forwards that header and runs the game in "production" env so
 * assets resolve to broken /api/assets paths. This middleware:
 *  1. Proxies HTML/JS/CSS/models from grudox under /embed/vox/* and /voxgrudge/*
 *  2. Strips frame-blocking headers and sets frame-ancestors for the portal
 *  3. Patches HTML so GrudgeEnv.detect() === "fleet" (bundled relative assets)
 */
const UPSTREAM = "https://grudox.grudge-studio.com/voxgrudge";

const FLEET_PATCH = `<script data-grudge-fleet-patch="1">
(function () {
  function forceFleet() {
    try {
      if (window.GrudgeEnv && typeof window.GrudgeEnv === "object") {
        window.GrudgeEnv.detect = function () { return "fleet"; };
        window.GrudgeEnv.isLiveDeploy = function () { return true; };
        window.GrudgeEnv.label = function () { return "FLEET"; };
      }
    } catch (e) {}
  }
  forceFleet();
  document.addEventListener("DOMContentLoaded", forceFleet);
  setTimeout(forceFleet, 0);
  setTimeout(forceFleet, 50);
  setTimeout(forceFleet, 250);
})();
</script>`;

function mapPath(pathname: string): string | null {
  if (pathname.startsWith("/embed/vox/")) {
    return pathname.slice("/embed/vox/".length);
  }
  if (pathname.startsWith("/voxgrudge/")) {
    return pathname.slice("/voxgrudge/".length);
  }
  return null;
}

function isHtml(contentType: string | null): boolean {
  return !!contentType && contentType.toLowerCase().includes("text/html");
}

export const config = {
  matcher: ["/embed/vox/:path*", "/voxgrudge/:path*"],
};

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rest = mapPath(url.pathname);
  if (rest === null) {
    return new Response("Not found", { status: 404 });
  }

  // Avoid path traversal
  if (rest.includes("..")) {
    return new Response("Bad path", { status: 400 });
  }

  const target = `${UPSTREAM}/${rest}${url.search}`;
  let upstream: Response;
  try {
    const headers = new Headers();
    const accept = request.headers.get("accept");
    if (accept) headers.set("accept", accept);
    headers.set("accept-encoding", "identity");
    headers.set("user-agent", request.headers.get("user-agent") || "Grudge-Embed-Proxy");
    upstream = await fetch(target, {
      method: request.method === "HEAD" ? "GET" : request.method,
      headers,
      redirect: "follow",
    });
  } catch (e) {
    return new Response(`Vox embed proxy failed: ${e instanceof Error ? e.message : e}`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const outHeaders = new Headers(upstream.headers);
  outHeaders.delete("x-frame-options");
  outHeaders.delete("content-security-policy");
  outHeaders.delete("content-security-policy-report-only");
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  outHeaders.set(
    "content-security-policy",
    [
      "default-src 'self' https: data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://static.cloudflareinsights.com https://*.grudge-studio.com https://*.vercel.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https: wss: blob:",
      "media-src 'self' https: blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'self' https://grudge-studio.com https://*.grudge-studio.com https://grudgewarlords.com https://*.vercel.app",
      "base-uri 'self'",
    ].join("; "),
  );
  outHeaders.set("x-grudge-embed-proxy", "1");
  outHeaders.set("access-control-allow-origin", "*");

  if (isHtml(outHeaders.get("content-type"))) {
    outHeaders.set("cache-control", "public, max-age=60, stale-while-revalidate=300");
  }

  if (request.method === "HEAD") {
    return new Response(null, { status: upstream.status, headers: outHeaders });
  }

  const ct = outHeaders.get("content-type") || "";
  if (isHtml(ct)) {
    let html = await upstream.text();
    if (!html.includes("data-grudge-fleet-patch")) {
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>\n${FLEET_PATCH}\n`);
      } else {
        html = FLEET_PATCH + html;
      }
      html = html.replace(
        /(grudge-env\.js["'][^>]*>\s*<\/script>)/i,
        `$1\n<script data-grudge-fleet-patch="2">if(window.GrudgeEnv){GrudgeEnv.detect=function(){return"fleet"};}</script>`,
      );
    }
    return new Response(html, { status: upstream.status, headers: outHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}
