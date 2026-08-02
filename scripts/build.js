// Build entrypoint: always runs `next build`, then runs `next-on-pages
// --skip-build` to generate the Worker entry-point (.vercel/output/static/
// _worker.js) required by the Cloudflare "Pages as Workers" deploy flow
// (`wrangler versions upload` reads it from wrangler.jsonc).
//
// On Windows the next-on-pages CLI cannot spawn npx (known shellac
// limitation), so we log a warning and continue — the Worker is generated in
// the Cloudflare (Linux) build. On Linux/macOS a real failure fails the build.

const { spawnSync } = require("child_process");

const run = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  return res;
};

const runNextBuild = () => {
  const res = run("next", ["build"]);
  if (res.error) {
    console.error("[build] Failed to spawn next:", res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
};

const runWorkerBuild = () => {
  console.log("[build] Generating Cloudflare Worker (_worker.js)...");
  const res = run("next-on-pages", ["--skip-build"]);
  if (res.error) {
    if (process.platform === "win32") {
      console.warn(
        "[build] next-on-pages unavailable on Windows (known shellac limitation). " +
        "The Worker will be generated during the Cloudflare build. Continuing..."
      );
      return;
    }
    console.error("[build] Failed to spawn next-on-pages:", res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) {
    if (process.platform === "win32") {
      console.warn("[build] next-on-pages failed on Windows (see output above). Continuing...");
      return;
    }
    process.exit(res.status ?? 1);
  }
};

runNextBuild();
runWorkerBuild();
console.log("[build] Done.");
