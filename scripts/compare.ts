import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import Hashids from "hashids";
import Sqids from "sqids";
import Optimus from "optimus-js";
import { Feistly } from "../src/index";

type BenchResult = {
  name: string;
  avgLength: number;
  encodeOps: number;
  decodeOps: number;
  sampleToken: string;
};

const SAMPLE_SIZE = 50000;
const SAMPLE_ID = 12345;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const ids = Array.from({ length: SAMPLE_SIZE }, (_, index) => index + 1);

const feistly = new Feistly({
  masterKey: "benchmark-secret",
  tagLength: 2,
  minLength: 0,
  alphabet: ALPHABET,
});

const hashids = new Hashids("benchmark-salt", 0, ALPHABET);
const sqids = new Sqids({ alphabet: ALPHABET, minLength: 0 });
const optimus = new Optimus(1580030173, 59260789, 1163945558);

function bench(label: string, fn: () => void): number {
  const start = performance.now();
  fn();
  const end = performance.now();
  const seconds = Math.max((end - start) / 1000, 0.000001);
  const opsPerSec = SAMPLE_SIZE / seconds;
  return Math.round(opsPerSec);
}

function averageLength(values: string[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value.length, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function buildResult(
  name: string,
  encode: (id: number) => string,
  decode: (token: string) => number | string
): BenchResult {
  const tokens = new Array<string>(SAMPLE_SIZE);

  const encodeOps = bench(`${name} encode`, () => {
    for (let i = 0; i < ids.length; i += 1) {
      tokens[i] = encode(ids[i]);
    }
  });

  const decodeOps = bench(`${name} decode`, () => {
    for (let i = 0; i < tokens.length; i += 1) {
      decode(tokens[i]);
    }
  });

  return {
    name,
    avgLength: averageLength(tokens),
    encodeOps,
    decodeOps,
    sampleToken: encode(SAMPLE_ID),
  };
}

const results: BenchResult[] = [
  buildResult(
    "Feistly",
    (id) => feistly.encrypt("user", id),
    (token) => feistly.decrypt("user", token)
  ),
  buildResult(
    "Hashids",
    (id) => hashids.encode(id),
    (token) => hashids.decode(token)[0] ?? 0
  ),
  buildResult(
    "Sqids",
    (id) => sqids.encode([id]),
    (token) => sqids.decode(token)[0] ?? 0
  ),
  buildResult(
    "Optimus",
    (id) => String(optimus.encode(id)),
    (token) => optimus.decode(Number(token))
  ),
];

const systemInfo = {
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  cpu: os.cpus()[0]?.model ?? "unknown",
  sampleSize: SAMPLE_SIZE,
  alphabetLength: ALPHABET.length,
};

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Feistly Comparison</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:wght@600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: light;
        --bg: #f8f4ee;
        --panel: #ffffff;
        --ink: #221c17;
        --muted: #6b5f55;
        --accent: #d75d4a;
        --accent-2: #2f6d7a;
        --grid: rgba(34, 28, 23, 0.1);
        --shadow: 0 24px 70px rgba(34, 28, 23, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Space Grotesk", "Segoe UI", sans-serif;
        background: radial-gradient(circle at 20% 20%, #f6e9de 0, transparent 45%),
          radial-gradient(circle at 80% 15%, #e9f1f4 0, transparent 50%),
          var(--bg);
        color: var(--ink);
      }

      .page {
        max-width: 1150px;
        margin: 0 auto;
        padding: 56px 24px 80px;
      }

      header {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 24px;
        align-items: center;
        margin-bottom: 36px;
      }

      h1 {
        font-family: "Fraunces", serif;
        font-size: clamp(2.4rem, 2.1rem + 1.8vw, 3.6rem);
        margin: 0 0 12px;
        letter-spacing: -0.02em;
      }

      p {
        margin: 0 0 12px;
        color: var(--muted);
        line-height: 1.6;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(215, 93, 74, 0.12);
        color: var(--accent);
        font-weight: 600;
        font-size: 0.85rem;
      }

      .panel {
        background: var(--panel);
        border-radius: 24px;
        padding: 28px;
        box-shadow: var(--shadow);
      }

      .grid {
        display: grid;
        gap: 24px;
      }

      .grid.columns-2 {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .grid.columns-3 {
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      }

      .stat {
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(34, 28, 23, 0.04);
      }

      .stat h3 {
        margin: 0 0 6px;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
      }

      .stat p {
        margin: 0;
        font-size: 1.1rem;
        color: var(--ink);
        font-weight: 600;
      }

      canvas {
        width: 100% !important;
        height: 320px !important;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
      }

      th,
      td {
        text-align: left;
        padding: 10px 8px;
        border-bottom: 1px solid rgba(34, 28, 23, 0.08);
      }

      th {
        font-size: 0.8rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .highlight {
        color: var(--accent-2);
        font-weight: 700;
      }

      footer {
        margin-top: 28px;
        font-size: 0.9rem;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <div>
          <span class="chip">Feistly comparison run</span>
          <h1>Feistly vs alternatives</h1>
          <p>
            Benchmark run on the local machine using the same alphabet and
            sample size. Data below is generated by scripts/compare.ts.
          </p>
        </div>
        <div class="panel grid columns-2">
          <div class="stat">
            <h3>Node</h3>
            <p>${systemInfo.node}</p>
          </div>
          <div class="stat">
            <h3>Platform</h3>
            <p>${systemInfo.platform}</p>
          </div>
          <div class="stat">
            <h3>CPU</h3>
            <p>${systemInfo.cpu}</p>
          </div>
          <div class="stat">
            <h3>Sample Size</h3>
            <p>${systemInfo.sampleSize.toLocaleString()}</p>
          </div>
        </div>
      </header>

      <section class="grid columns-2">
        <div class="panel">
          <h2>Average token length</h2>
          <canvas id="lengthChart"></canvas>
        </div>
        <div class="panel">
          <h2>Encode speed (ops/sec)</h2>
          <canvas id="encodeChart"></canvas>
        </div>
        <div class="panel">
          <h2>Decode speed (ops/sec)</h2>
          <canvas id="decodeChart"></canvas>
        </div>
        <div class="panel">
          <h2>Sample output</h2>
          <table>
            <thead>
              <tr>
                <th>Library</th>
                <th>Token for ${SAMPLE_ID}</th>
              </tr>
            </thead>
            <tbody>
              ${results
                .map(
                  (row) =>
                    `<tr><td>${row.name}</td><td class="highlight">${row.sampleToken}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        <div class="panel">
          <p>
            Notes: Hashids and Sqids are non-cryptographic encoders. Feistly adds
            HMAC-based Feistel encryption plus tag validation. Optimus permutes
            integers (no authentication tag). Adjust sample size or settings in
            scripts/compare.ts to rerun.
          </p>
        </div>
      </footer>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <script>
      const data = ${JSON.stringify(results)};

      const labels = data.map((row) => row.name);
      const lengthData = data.map((row) => row.avgLength);
      const encodeData = data.map((row) => row.encodeOps);
      const decodeData = data.map((row) => row.decodeOps);

      const palette = ["#d75d4a", "#2f6d7a", "#b38c42", "#595b7a"];

      const baseOptions = {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#221c17",
            padding: 12,
            titleColor: "#f8f4ee",
            bodyColor: "#f8f4ee",
          },
        },
        scales: {
          y: {
            grid: { color: "rgba(34, 28, 23, 0.08)" },
            ticks: { color: "#6b5f55" },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#6b5f55" },
          },
        },
      };

      new Chart(document.getElementById("lengthChart"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              data: lengthData,
              backgroundColor: palette,
              borderRadius: 10,
            },
          ],
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: { ...baseOptions.scales.y, title: { display: true, text: "chars" } },
          },
        },
      });

      new Chart(document.getElementById("encodeChart"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              data: encodeData,
              backgroundColor: palette,
              borderRadius: 10,
            },
          ],
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              title: { display: true, text: "ops/sec" },
            },
          },
        },
      });

      new Chart(document.getElementById("decodeChart"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              data: decodeData,
              backgroundColor: palette,
              borderRadius: 10,
            },
          ],
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              title: { display: true, text: "ops/sec" },
            },
          },
        },
      });
    </script>
  </body>
</html>
`;

const json = {
  generatedAt: new Date().toISOString(),
  system: systemInfo,
  results,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

await fs.writeFile(path.join(rootDir, "compare.html"), html, "utf8");
await fs.writeFile(path.join(rootDir, "compare.json"), JSON.stringify(json, null, 2), "utf8");

console.log("compare.html and compare.json generated.");
