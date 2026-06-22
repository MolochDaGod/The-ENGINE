import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "public", "grudge-id.html"), "utf8");
const out = `// Auto-generated from public/grudge-id.html — run: node scripts/gen-auth-page.mjs\nexport const AUTH_PAGE_HTML = ${JSON.stringify(html)};\n`;
fs.writeFileSync(path.join(__dirname, "..", "server", "auth-page-html.ts"), out);
console.log("auth-page-html.ts regenerated (" + html.length + " chars)");