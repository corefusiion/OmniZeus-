const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { performance } = require('perf_hooks');

// 1. Load and Transpile src/lib/auth/passwordUtils.ts
const targetFilePath = path.join(__dirname, '..', 'src', 'lib', 'auth', 'passwordUtils.ts');
const tsSource = fs.readFileSync(targetFilePath, 'utf8');

const transpiled = ts.transpileModule(tsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
});

// Execute the transpiled code in a module wrapper to extract exports
const scriptModule = { exports: {} };
const runScript = new Function('module', 'exports', 'globalThis', 'crypto', 'TextEncoder', 'Uint8Array', transpiled.outputText);
runScript(scriptModule, scriptModule.exports, globalThis, globalThis.crypto, TextEncoder, Uint8Array);

const {
  hashPassword,
  verifyPassword,
  validatePasswordRequirements,
  generateTemporaryPassword,
  DEFAULT_PBKDF2_ITERATIONS
} = scriptModule.exports;

// Helper: derive PBKDF2 hash with custom iterations (to create 210,000 iteration test vectors)
async function deriveCustomPbkdf2(password, salt, iterations) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: iterations, hash: "SHA-256" },
    key,
    32 * 8
  );
  const hex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$${iterations}$${salt}$${hex}`;
}

// Helper: derive plain SHA-256 hex
async function deriveSha256Hex(password) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Helper: Statistical calculations
function calcStats(timesMs, cpuTimesUs) {
  const n = timesMs.length;
  const sumMs = timesMs.reduce((a, b) => a + b, 0);
  const meanMs = sumMs / n;
  const minMs = Math.min(...timesMs);
  const maxMs = Math.max(...timesMs);
  
  const sorted = [...timesMs].sort((a, b) => a - b);
  const medianMs = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  
  const variance = timesMs.reduce((acc, val) => acc + Math.pow(val - meanMs, 2), 0) / n;
  const stdDevMs = Math.sqrt(variance);
  
  const sumCpuUs = cpuTimesUs.reduce((a, b) => a + b, 0);
  const meanCpuMs = (sumCpuUs / n) / 1000;
  
  return {
    count: n,
    totalMs: sumMs,
    meanMs,
    medianMs,
    minMs,
    maxMs,
    stdDevMs,
    opsPerSec: (1000 / meanMs).toFixed(2),
    meanCpuMs
  };
}

async function runBenchmarks() {
  console.log("=========================================================");
  console.log("  M-LOGIN: Password Utils Benchmark & Verification Suite");
  console.log("=========================================================");
  console.log(`Default PBKDF2 Iterations in code: ${DEFAULT_PBKDF2_ITERATIONS}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform} (${process.arch})`);
  console.log("---------------------------------------------------------\n");

  const samplePassword = "Design20!Password";

  // ---------------------------------------------------------
  // 1. BENCHMARK: 10,000 Iterations (New Standard)
  // ---------------------------------------------------------
  console.log("--- 1. Benchmarking 10,000 Iterations (hashPassword / verifyPassword) ---");
  const iterations10k = 100;
  const times10kMs = [];
  const cpuTimes10kUs = [];

  // Warmup
  await hashPassword(samplePassword);

  for (let i = 0; i < iterations10k; i++) {
    const startCpu = process.cpuUsage();
    const startWall = performance.now();

    const hash = await hashPassword(samplePassword);

    const wallDiff = performance.now() - startWall;
    const cpuDiff = process.cpuUsage(startCpu);
    const cpuMicrosec = cpuDiff.user + cpuDiff.system;

    times10kMs.push(wallDiff);
    cpuTimes10kUs.push(cpuMicrosec);
  }

  const stats10k = calcStats(times10kMs, cpuTimes10kUs);
  console.log(`Runs: ${stats10k.count}`);
  console.log(`Total Wall Time: ${stats10k.totalMs.toFixed(2)} ms`);
  console.log(`Mean Wall Time per Hash: ${stats10k.meanMs.toFixed(4)} ms`);
  console.log(`Median Wall Time: ${stats10k.medianMs.toFixed(4)} ms`);
  console.log(`Min Wall Time: ${stats10k.minMs.toFixed(4)} ms`);
  console.log(`Max Wall Time: ${stats10k.maxMs.toFixed(4)} ms`);
  console.log(`Std Dev: ${stats10k.stdDevMs.toFixed(4)} ms`);
  console.log(`Mean CPU Time per Hash: ${stats10k.meanCpuMs.toFixed(4)} ms`);
  console.log(`Throughput: ${stats10k.opsPerSec} ops/sec\n`);

  // Benchmark verifyPassword with 10k hash
  const hash10kSample = await hashPassword(samplePassword);
  const verifyTimes10kMs = [];
  for (let i = 0; i < 50; i++) {
    const startWall = performance.now();
    const ok = await verifyPassword(samplePassword, hash10kSample);
    const wallDiff = performance.now() - startWall;
    if (!ok) throw new Error("Verify failed for 10k hash!");
    verifyTimes10kMs.push(wallDiff);
  }
  const verifyStats10k = calcStats(verifyTimes10kMs, verifyTimes10kMs.map(() => 0));
  console.log(`Mean verifyPassword Wall Time (10k): ${verifyStats10k.meanMs.toFixed(4)} ms\n`);

  // ---------------------------------------------------------
  // 2. BENCHMARK: 210,000 Iterations (Legacy Standard)
  // ---------------------------------------------------------
  console.log("--- 2. Benchmarking 210,000 Iterations (verifyPassword Legacy) ---");
  const iterations210k = 20; // smaller count due to higher execution time
  const times210kMs = [];
  const cpuTimes210kUs = [];

  const legacySalt = "1234567890abcdef1234567890abcdef";
  const legacy210kHash = await deriveCustomPbkdf2(samplePassword, legacySalt, 210000);

  // Warmup
  await verifyPassword(samplePassword, legacy210kHash);

  for (let i = 0; i < iterations210k; i++) {
    const startCpu = process.cpuUsage();
    const startWall = performance.now();

    const ok = await verifyPassword(samplePassword, legacy210kHash);
    if (!ok) throw new Error("Verify failed for 210k hash!");

    const wallDiff = performance.now() - startWall;
    const cpuDiff = process.cpuUsage(startCpu);
    const cpuMicrosec = cpuDiff.user + cpuDiff.system;

    times210kMs.push(wallDiff);
    cpuTimes210kUs.push(cpuMicrosec);
  }

  const stats210k = calcStats(times210kMs, cpuTimes210kUs);
  console.log(`Runs: ${stats210k.count}`);
  console.log(`Total Wall Time: ${stats210k.totalMs.toFixed(2)} ms`);
  console.log(`Mean Wall Time per Verification: ${stats210k.meanMs.toFixed(4)} ms`);
  console.log(`Median Wall Time: ${stats210k.medianMs.toFixed(4)} ms`);
  console.log(`Min Wall Time: ${stats210k.minMs.toFixed(4)} ms`);
  console.log(`Max Wall Time: ${stats210k.maxMs.toFixed(4)} ms`);
  console.log(`Std Dev: ${stats210k.stdDevMs.toFixed(4)} ms`);
  console.log(`Mean CPU Time per Verification: ${stats210k.meanCpuMs.toFixed(4)} ms`);
  console.log(`Throughput: ${stats210k.opsPerSec} ops/sec\n`);

  // ---------------------------------------------------------
  // 3. COMPARATIVE RATIO ANALYSIS
  // ---------------------------------------------------------
  console.log("--- 3. Performance & Resource Consumption Comparison ---");
  const wallTimeRatio = stats210k.meanMs / stats10k.meanMs;
  const cpuTimeRatio = stats210k.meanCpuMs / stats10k.meanCpuMs;
  const latencyReduction = ((1 - (stats10k.meanMs / stats210k.meanMs)) * 100).toFixed(2);

  console.log(`Iteration Ratio (210,000 / 10,000): 21.00x`);
  console.log(`Empirical Wall-Clock Time Ratio (210k / 10k): ${wallTimeRatio.toFixed(2)}x`);
  console.log(`Empirical CPU Time Ratio (210k / 10k): ${cpuTimeRatio.toFixed(2)}x`);
  console.log(`Latency Reduction (210k -> 10k): ${latencyReduction}% reduction`);
  console.log(`10,000 iterations wall time: ${stats10k.meanMs.toFixed(2)} ms/op`);
  console.log(`210,000 iterations wall time: ${stats210k.meanMs.toFixed(2)} ms/op\n`);

  // ---------------------------------------------------------
  // 4. BACKWARDS COMPATIBILITY VERIFICATION SUITE
  // ---------------------------------------------------------
  console.log("--- 4. Backwards Compatibility Verification Suite ---");
  const testResults = [];

  function recordTest(name, passed, details = "") {
    testResults.push({ name, passed, details });
    const status = passed ? "[PASS]" : "[FAIL]";
    console.log(`${status} ${name}${details ? ` (${details})` : ""}`);
  }

  // Case A: Legacy PBKDF2 (210,000 iterations)
  const legacyHash210k = await deriveCustomPbkdf2("SecretPass123!", "abcd1234efgh5678", 210000);
  const okLegacy210kValid = await verifyPassword("SecretPass123!", legacyHash210k);
  const okLegacy210kInvalid = await verifyPassword("WrongPass123!", legacyHash210k);
  recordTest(
    "Legacy PBKDF2 210,000 iterations verification",
    okLegacy210kValid === true && okLegacy210kInvalid === false,
    `Valid: ${okLegacy210kValid}, Invalid: ${okLegacy210kInvalid}`
  );

  // Case B: New PBKDF2 (10,000 iterations)
  const newHash10k = await hashPassword("SecretPass123!");
  const okNew10kValid = await verifyPassword("SecretPass123!", newHash10k);
  const okNew10kInvalid = await verifyPassword("WrongPass123!", newHash10k);
  recordTest(
    "New PBKDF2 10,000 iterations verification",
    okNew10kValid === true && okNew10kInvalid === false,
    `Valid: ${okNew10kValid}, Invalid: ${okNew10kInvalid}`
  );

  // Case C: Legacy SHA-256 (64 hex characters)
  const sha256Hash = await deriveSha256Hex("Design20");
  const okShaValid = await verifyPassword("Design20", sha256Hash);
  const okShaInvalid = await verifyPassword("WrongPassword", sha256Hash);
  const okShaCaseInsensitive = await verifyPassword("Design20", sha256Hash.toUpperCase());
  recordTest(
    "Legacy SHA-256 (64-char hex) verification",
    okShaValid === true && okShaInvalid === false && okShaCaseInsensitive === true,
    `Valid: ${okShaValid}, Invalid: ${okShaInvalid}, UpperHex: ${okShaCaseInsensitive}`
  );

  // Case D: Legacy Plaintext Passwords
  const okPlaintextValid = await verifyPassword("Design20", "Design20");
  const okPlaintextInvalid = await verifyPassword("Design20", "DifferentPassword");
  recordTest(
    "Legacy Plaintext password verification",
    okPlaintextValid === true && okPlaintextInvalid === false,
    `Valid: ${okPlaintextValid}, Invalid: ${okPlaintextInvalid}`
  );

  // Case E: Edge Cases & Resiliency
  const emptyPass = await verifyPassword("", newHash10k);
  const emptyStored = await verifyPassword("password", "");
  const nullPass = await verifyPassword(null, newHash10k);
  const malformedPbkdf2 = await verifyPassword("password", "pbkdf2$10000$onlysalt");
  const invalidIterPbkdf2 = await verifyPassword("password", "pbkdf2$invalid$salt$hash");

  recordTest(
    "Edge cases handling (empty/null/malformed inputs)",
    emptyPass === false && emptyStored === false && nullPass === false && malformedPbkdf2 === false && invalidIterPbkdf2 === false,
    `EmptyPass: ${emptyPass}, EmptyStored: ${emptyStored}, NullPass: ${nullPass}, Malformed: ${malformedPbkdf2}, InvalidIter: ${invalidIterPbkdf2}`
  );

  // Case F: Password Generator & Policy Validation
  const tempPass = generateTemporaryPassword();
  const validation = validatePasswordRequirements(tempPass);
  recordTest(
    "Temporary Password Generator satisfies policy",
    validation.isValid === true && tempPass.length === 12,
    `Length: ${tempPass.length}, Valid: ${validation.isValid}`
  );

  const passedCount = testResults.filter(t => t.passed).length;
  console.log(`\nVerification Summary: ${passedCount}/${testResults.length} tests passed.`);

  // Write structured JSON results file for artifact recording
  const benchmarkReport = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    iterations10k: stats10k,
    iterations210k: stats210k,
    ratios: {
      wallTimeRatio: parseFloat(wallTimeRatio.toFixed(2)),
      cpuTimeRatio: parseFloat(cpuTimeRatio.toFixed(2)),
      latencyReductionPercent: parseFloat(latencyReduction)
    },
    testResults
  };

  const reportPath = path.join(__dirname, '..', '.agents', 'challenger_login_1', 'benchmark_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(benchmarkReport, null, 2));
  console.log(`Benchmark results saved to: ${reportPath}`);
}

runBenchmarks().catch(err => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
