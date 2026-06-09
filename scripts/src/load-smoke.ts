type EndpointResult = {
  endpoint: string;
  total: number;
  ok: number;
  failed: number;
  statusFailures: Record<string, number>;
  durations: number[];
};

const baseUrl = (process.env.LOAD_TEST_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const endpoints = (process.env.LOAD_TEST_ENDPOINTS ?? "/api/healthz,/api/healthz/deep")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const totalRequests = parsePositiveInt(process.env.LOAD_TEST_REQUESTS, 60);
const concurrency = parsePositiveInt(process.env.LOAD_TEST_CONCURRENCY, 6);
const timeoutMs = parsePositiveInt(process.env.LOAD_TEST_TIMEOUT_MS, 5000);
const maxFailureRate = parseFloat(process.env.LOAD_TEST_MAX_FAILURE_RATE ?? "0.05");
const maxP95Ms = parsePositiveInt(process.env.LOAD_TEST_MAX_P95_MS, 2000);

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

async function timedFetch(url: string): Promise<{ ok: boolean; status: number | "timeout" | "network"; ms: number }> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    return { ok: res.ok, status: res.status, ms: performance.now() - started };
  } catch (error) {
    const status = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
    return { ok: false, status, ms: performance.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function runEndpoint(endpoint: string): Promise<EndpointResult> {
  const result: EndpointResult = {
    endpoint,
    total: totalRequests,
    ok: 0,
    failed: 0,
    statusFailures: {},
    durations: [],
  };

  let next = 0;

  async function worker() {
    while (next < totalRequests) {
      next += 1;
      const response = await timedFetch(`${baseUrl}${endpoint}`);
      result.durations.push(response.ms);

      if (response.ok) {
        result.ok += 1;
      } else {
        result.failed += 1;
        const key = String(response.status);
        result.statusFailures[key] = (result.statusFailures[key] ?? 0) + 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));
  return result;
}

function printResult(result: EndpointResult) {
  const avg = result.durations.reduce((sum, n) => sum + n, 0) / Math.max(result.durations.length, 1);
  const p50 = percentile(result.durations, 50);
  const p95 = percentile(result.durations, 95);
  const p99 = percentile(result.durations, 99);
  const failureRate = result.failed / Math.max(result.total, 1);

  console.log(`\n${result.endpoint}`);
  console.log(`  total=${result.total} ok=${result.ok} failed=${result.failed} failureRate=${(failureRate * 100).toFixed(2)}%`);
  console.log(`  avg=${avg.toFixed(1)}ms p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
  if (Object.keys(result.statusFailures).length > 0) {
    console.log(`  failures=${JSON.stringify(result.statusFailures)}`);
  }

  return { failureRate, p95 };
}

async function main() {
  console.log("MUHKAM load smoke test");
  console.log(`baseUrl=${baseUrl}`);
  console.log(`requests=${totalRequests} concurrency=${concurrency} timeoutMs=${timeoutMs}`);
  console.log(`thresholds=maxFailureRate=${maxFailureRate} maxP95Ms=${maxP95Ms}`);

  let failed = false;

  for (const endpoint of endpoints) {
    const result = await runEndpoint(endpoint);
    const summary = printResult(result);

    if (summary.failureRate > maxFailureRate || summary.p95 > maxP95Ms) {
      failed = true;
    }
  }

  if (failed) {
    console.error("\nLOAD_TEST_FAILED=YES");
    process.exit(1);
  }

  console.log("\nLOAD_TEST_PASSED=YES");
}

main().catch((error) => {
  console.error("LOAD_TEST_ERROR", error);
  process.exit(1);
});
