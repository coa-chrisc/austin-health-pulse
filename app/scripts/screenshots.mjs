// Regenerates the README screenshots in docs/screenshots/.
// Usage (from app/): npm run screenshots [-- shot-name-filter]
// Needs Google Chrome (override with CHROME_PATH) and Node 22+. No extra deps.
// For each build group it runs `vite build` into a temp dir, serves it with
// `vite preview`, drives headless Chrome over the DevTools Protocol, and
// cleans everything up. Tiles for the map shot load from tile.openstreetmap.org.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.resolve(APP_DIR, "../docs/screenshots");
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TOUR_KEY = "aph_tour_seen_v1";
const filter = process.argv[2];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer().once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} failed:\n${out.slice(-2000)}`)),
    );
  });
}

async function poll(fn, what, timeout = 30000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${what}${last ? ` (${last.message})` : ""}`);
}

// Every spawned server/browser, so Ctrl-C can stop them (they run detached).
const children = new Set();

const killTree = (p) => {
  if (!p || p.exitCode !== null) return;
  try {
    process.kill(-p.pid, "SIGTERM");
  } catch {
    p.kill("SIGTERM");
  }
};

/** Minimal CDP client over Node's global WebSocket. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("CDP websocket failed"));
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      pending.set(++id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
    return r.result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

// Page-side helper, injected as a string: finds the smallest visible element whose text contains `t`.
const FIND = `(t, sel='h1,h2,h3,h4,p,a,button,span,label') =>
  [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(t) && e.offsetParent !== null)`;

function pageApi(cdp, shot) {
  const api = {
    waitFor: (expr, what) => poll(() => cdp.evaluate(expr), `${what} in shot ${shot}`),
    waitText: (t, sel) => api.waitFor(`!!(${FIND})(${q(t)}, ${q(sel)})`, `text "${t}"`),
    /** Set a React-controlled input's value. */
    async type(selector, value) {
      await api.waitFor(`!!document.querySelector(${q(selector)})`, `input ${selector}`);
      await cdp.evaluate(`(() => {
        const el = document.querySelector(${q(selector)}); el.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${q(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
    },
    async press(key) {
      const p = { key, code: key, windowsVirtualKeyCode: 13, text: "\r" };
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...p });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...p });
    },
    async clickText(t, sel = "button") {
      await api.waitText(t, sel);
      await cdp.evaluate(`(${FIND})(${q(t)}, ${q(sel)}).click()`);
    },
    async scrollToText(t, sel) {
      await api.waitText(t, sel);
      await cdp.evaluate(`(${FIND})(${q(t)}, ${q(sel)}).scrollIntoView({ block: 'start' })`);
      await sleep(600);
    },
  };
  return api;
}

const ZIP_SUBMIT = (zip) => async (p) => {
  await p.type('input[aria-label="ZIP code"]', zip);
  await p.clickText("Explore");
  await p.waitText(`ZIP Code ${zip}`, "span");
  await p.waitFor(`(window.scrollTo(0, 0), true)`, "scroll to top");
  await sleep(1500); // count-up animation
};

const GROUPS = [
  {
    name: "A: live demo (calculator on, service guide links on)",
    env: { VITE_ENABLE_PERSONAL_CALCULATOR: "true", VITE_SERVICE_GUIDE_URL: "https://services.example.org" },
    shots: [
      {
        file: "01-map.png",
        hash: "#/explore",
        async run(p) {
          await p.waitFor(`document.querySelectorAll('path.leaflet-interactive').length > 10`, "choropleth ZIPs");
          await p.waitFor(
            `(() => { const t = [...document.querySelectorAll('.leaflet-tile')];
              return t.length > 0 && t.every((i) => i.complete && i.naturalWidth > 0); })()`,
            "map tiles",
          );
          await sleep(800);
        },
      },
      {
        file: "02-neighborhood-zip.png",
        hash: "#/",
        async run(p) {
          await ZIP_SUBMIT("78721")(p);
        },
      },
      {
        file: "02b-zip-indicators.png",
        hash: "#/",
        async run(p) {
          await ZIP_SUBMIT("78721")(p);
          await p.scrollToText("Health Indicators", "h3");
        },
      },
      {
        file: "03-lifespan-estimator.png",
        hash: "#/",
        async run(p) {
          await p.scrollToText("How do personal factors affect life expectancy?", "h2,h3");
        },
      },
      {
        // The estimator's result card links to the Service Guide once a factor has room to improve.
        file: "04-service-handoff.png",
        hash: "#/",
        async run(p) {
          await p.waitText("Estimated lifespan", "p,span,div");
          await p.scrollToText("services that can help", "a,button");
          await cdpScrollBack(p);
        },
      },
      {
        file: "05-compare-zips.png",
        hash: "#/compare",
        async run(p) {
          for (const zip of ["78721", "78732", "78741"]) {
            await p.type('input[aria-label="Search ZIP codes"]', zip);
            await p.press("Enter");
            await sleep(300);
          }
          await p.waitText("78741", "span,td,th");
          await sleep(1500); // chart animations
        },
      },
      {
        // The simulator renders regardless of the calculator flag, so it needs no build of its own.
        file: "06-scenario-simulator.png",
        hash: "#/",
        async run(p) {
          await p.scrollToText("Neighborhood Equity Scenario Simulator", "h3");
        },
      },
    ],
  },
  {
    name: "C: partner-city-demo",
    env: { CITY_CONFIG: "presets/partner-city-demo.json", BASE_PATH: "/" },
    base: "/",
    shots: [
      {
        file: "07-partner-city.png",
        hash: "#/",
        async run(p) {
          await ZIP_SUBMIT("77002")(p);
          // Keep the header in frame: it carries the partner logo and colors.
          await p.waitFor(`(window.scrollTo(0, 0), true)`, "scroll to top");
        },
      },
    ],
  },
];

// Put the CTA card a little below the top edge so its context shows.
async function cdpScrollBack(p) {
  await p.waitFor(`(window.scrollBy(0, -420), true)`, "scroll");
  await sleep(300);
}

async function captureGroup(group, chromeWs, tmpRoot) {
  const outDir = path.join(tmpRoot, `dist-${Math.random().toString(36).slice(2)}`);
  const env = { ...process.env, ...group.env };
  const port = await freePort();
  const base = group.env.BASE_PATH ?? "/austin-health-pulse/";
  let preview;
  try {
    console.log(`\nBuilding ${group.name}`);
    await run("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], { cwd: APP_DIR, env });
    preview = spawn("npx", ["vite", "preview", "--outDir", outDir, "--port", String(port), "--strictPort"], {
      cwd: APP_DIR,
      env,
      stdio: "ignore",
      detached: true,
    });
    children.add(preview);
    const url = `http://localhost:${port}${base}`;
    await poll(() => fetch(url).then((r) => r.ok), `preview at ${url}`);

    for (const shot of group.shots) {
      if (filter && !shot.file.includes(filter)) continue;
      const { id: targetId } = await (await fetch(`${chromeWs.http}/json/new?about:blank`, { method: "PUT" })).json();
      const target = (await (await fetch(`${chromeWs.http}/json/list`)).json()).find((t) => t.id === targetId);
      const cdp = await connect(target.webSocketDebuggerUrl);
      try {
        await cdp.send("Page.enable");
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
        });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
          source: `localStorage.setItem(${q(TOUR_KEY)}, "1")`,
        });
        await cdp.send("Page.navigate", { url: url + shot.hash });
        const page = pageApi(cdp, shot.file);
        await page.waitFor(`document.readyState === 'complete' && !!document.querySelector('h1,h2,h3')`, "page load");
        await shot.run(page);
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
        await writeFile(path.join(OUT_DIR, shot.file), Buffer.from(data, "base64"));
        console.log(`  wrote ${shot.file}`);
      } finally {
        cdp.close();
        // Best-effort tab close; Chrome itself is killed in the outer finally.
        await fetch(`${chromeWs.http}/json/close/${targetId}`).catch(() => {});
      }
    }
  } finally {
    killTree(preview);
    await rm(outDir, { recursive: true, force: true });
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "aph-shots-"));
  const chromePort = await freePort();
  const chrome = spawn(
    CHROME,
    ["--headless=new", `--remote-debugging-port=${chromePort}`, `--user-data-dir=${path.join(tmpRoot, "profile")}`,
      "--no-first-run", "--no-default-browser-check", "--hide-scrollbars"],
    { stdio: "ignore", detached: true },
  );
  children.add(chrome);
  const cleanup = () => killTree(chrome);
  const abort = (code) => {
    for (const child of children) killTree(child);
    rmSync(tmpRoot, { recursive: true, force: true });
    process.exit(code);
  };
  chrome.once("error", (e) => {
    console.error(`Could not start Chrome at ${CHROME} (${e.message}). Set CHROME_PATH.`);
    abort(1);
  });
  process.on("SIGINT", () => abort(130));
  try {
    const http = `http://127.0.0.1:${chromePort}`;
    await poll(() => fetch(`${http}/json/version`).then((r) => r.ok), "Chrome DevTools endpoint");
    for (const group of GROUPS) await captureGroup(group, { http }, tmpRoot);
  } finally {
    cleanup();
    await sleep(300);
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
