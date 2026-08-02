// Build entrypoint: on Cloudflare Pages (CF_PAGES=1) runs next-on-pages so the
// worker entry-point (.vercel/output/static/_worker.js) is generated for
// `wrangler versions upload`. Locally it behaves as plain `next build`.

const { spawnSync } = require("child_process");

const isCloudflare = process.env.CF_PAGES === "1";

const run = (cmd, args) => {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.error) {
    console.error(`[build] Failed to spawn ${cmd}:`, res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
};

console.log(`[build] Environment: ${isCloudflare ? "Cloudflare Pages" : "local"}`);
run("next", ["build"]);
if (isCloudflare) {
  console.log("[build] Cloudflare detected — running next-on-pages to generate the Worker...");
  run("next-on-pages", []);
}
console.log("[build] Done.");
