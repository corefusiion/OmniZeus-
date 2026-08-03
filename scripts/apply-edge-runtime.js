// Rewrites all API route handlers to use the Edge Runtime (required by
// @cloudflare/next-on-pages). Idempotent: existing `runtime = "nodejs"`
// becomes `"edge"`; routes without a runtime export get one added after
// their last import.
const fs = require("fs");
const path = require("path");

const apiDir = path.join(__dirname, "..", "src", "app", "api");
const targets = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "route.ts") targets.push(full);
  }
}
walk(apiDir);

let changed = 0;
for (const file of targets) {
  let src = fs.readFileSync(file, "utf8");
  const hasRuntime = /export\s+const\s+runtime\s*=/.test(src);

  if (hasRuntime) {
    const next = src.replace(/export\s+const\s+runtime\s*=\s*["']nodejs["'];?/, 'export const runtime = "edge";');
    if (next !== src) {
      fs.writeFileSync(file, next);
      changed++;
      console.log(`[edge] switched -> ${path.relative(process.cwd(), file)}`);
    }
    continue;
  }

  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(import|from)\s/.test(lines[i])) lastImport = i;
  }
  const insertAt = lastImport >= 0 ? lastImport + 1 : 0;
  lines.splice(insertAt, 0, '', 'export const runtime = "edge";');
  fs.writeFileSync(file, lines.join("\n"));
  changed++;
  console.log(`[edge] added   -> ${path.relative(process.cwd(), file)}`);
}

console.log(`\n[edge] done. ${changed} route(s) updated of ${targets.length} total.`);
