#!/usr/bin/env node
// crash-upload: uploads debug symbols, ProGuard mappings and JS source maps to the crash portal.
// Spec: integrate.md §3, api.md §3. Node 22+, no dependencies. Never talks to sentry.io.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "0.1.0";
const HELP = `crash-upload ${VERSION}

Environment: CRASH_UPLOAD_TOKEN (secret), CRASH_PROJECT_ID, CRASH_URL (default https://crash.apsinthion.llc)

  whoami                                         check the token
  debug-files <path>...                          upload native debug files (.so, ELF, .pdb, .dll/.exe, dSYM, .sym, .wasm)
  proguard --uuid <uuid> <mapping.txt>           upload an Android R8/ProGuard mapping
  sourcemaps inject <dir>                        add debug IDs to .js + .map pairs (offline, idempotent)
  sourcemaps upload <dir> [--release R] [--dist D] [--url-prefix "~/assets"]

Flags: --soft  turn failures into warnings (exit 0)`;

// ---------- args ----------
const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--soft" || a === "--help" || a === "-h" || a === "--version") flags[a.replace(/^-+/, "")] = true;
  else if (a.startsWith("--")) flags[a.slice(2)] = argv[++i];
  else pos.push(a);
}

class Fail extends Error {}
const fail = (m) => {
  throw new Fail(m);
};
const log = (...a) => console.log(...a);

// ---------- http ----------
const BASE = (process.env.CRASH_URL || "https://crash.apsinthion.llc").replace(/\/+$/, "");
const TOKEN = process.env.CRASH_UPLOAD_TOKEN;
const PROJECT = process.env.CRASH_PROJECT_ID;

async function http(method, p, { body, headers = {} } = {}) {
  if (!TOKEN) fail("CRASH_UPLOAD_TOKEN is not set");
  let res;
  try {
    res = await fetch(BASE + p, { method, body, headers: { authorization: `Bearer ${TOKEN}`, "user-agent": `crash-upload/${VERSION}`, ...headers } });
  } catch (e) {
    fail(`Cannot reach ${BASE}: ${e.cause?.message ?? e.message}`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) fail(`${method} ${p}: HTTP ${res.status} ${json?.message ?? text.slice(0, 200)}`);
  return json;
}
const projectPath = (sub) => {
  if (!PROJECT || !/^\d+$/.test(PROJECT)) fail("CRASH_PROJECT_ID is not set (the numeric project ID from the portal)");
  return `/upload/v1/projects/${PROJECT}/${sub}`;
};

// ---------- fs helpers ----------
function* walk(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return yield p;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    yield* walk(path.join(p, e.name));
  }
}
const sha256File = (p) =>
  new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(p).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
const posix = (p) => p.split(path.sep).join("/");

// ---------- whoami ----------
async function whoami() {
  const r = await http("GET", "/upload/v1/whoami");
  log(`OK: token is for project ${r.project} (id ${r.project_id}) on ${BASE}`);
  if (PROJECT && String(r.project_id) !== PROJECT) fail(`CRASH_PROJECT_ID=${PROJECT} but the token belongs to project ${r.project_id}`);
}

// ---------- debug files ----------
function head(p, n) {
  const fd = fs.openSync(p, "r");
  const b = Buffer.alloc(n);
  const got = fs.readSync(fd, b, 0, n, 0);
  fs.closeSync(fd);
  return b.subarray(0, got);
}
function debugKind(p) {
  const b = head(p, 32);
  if (b.length < 8) return null;
  const u32be = b.readUInt32BE(0);
  if (b[0] === 0x7f && b.toString("latin1", 1, 4) === "ELF") {
    const type = b[5] === 2 ? b.readUInt16BE(16) : b.readUInt16LE(16);
    return type === 1 ? null : "elf"; // ET_REL (.o object files) carry no usable module identity
  }
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(u32be)) return "macho";
  if (u32be === 0xcafebabe && b.readUInt32BE(4) < 40) return "macho-fat"; // not a Java class file
  if (b.toString("latin1", 0, 2) === "MZ") return "pe";
  if (b.toString("latin1", 0, 24) === "Microsoft C/C++ MSF 7.00") return "pdb";
  if (b.toString("latin1", 0, 4) === "BSJB") return "portablepdb";
  if (b.toString("latin1", 0, 7) === "MODULE ") return "breakpad";
  if (b[0] === 0 && b.toString("latin1", 1, 4) === "asm") return "wasm";
  if (/\.src\.zip$/i.test(p) && b.toString("latin1", 0, 2) === "PK") return "sourcebundle";
  return null;
}
function debugCandidates(paths) {
  const out = [];
  for (const root of paths) {
    if (!fs.existsSync(root)) fail(`Not found: ${root}`);
    const stack = [root];
    while (stack.length) {
      const p = stack.pop();
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (/\.dSYM$/i.test(p)) {
          const dwarf = path.join(p, "Contents", "Resources", "DWARF");
          if (fs.existsSync(dwarf)) for (const f of fs.readdirSync(dwarf)) out.push(path.join(dwarf, f));
          continue;
        }
        for (const e of fs.readdirSync(p)) if (![".git", "node_modules", "CMakeFiles"].includes(e)) stack.push(path.join(p, e));
      } else if (st.size >= 64 && debugKind(p)) out.push(p);
    }
  }
  return [...new Set(out)];
}
async function debugFiles(paths) {
  if (!paths.length) fail("usage: debug-files <path>...");
  const files = debugCandidates(paths);
  if (!files.length) return log("No debug files found.");
  const hashes = new Map();
  for (const f of files) hashes.set(f, await sha256File(f));
  const { known } = await http("POST", projectPath("debug-files/known"), {
    body: JSON.stringify({ sha256: [...hashes.values()] }),
    headers: { "content-type": "application/json" },
  });
  const knownSet = new Set(known);
  const todo = files.filter((f) => !knownSet.has(hashes.get(f)));
  log(`${files.length} debug file(s) found, ${files.length - todo.length} already on the server, uploading ${todo.length}.`);
  let failed = 0, skipped = 0;
  for (const f of todo) {
    try {
      const r = await http("POST", projectPath(`debug-files?name=${encodeURIComponent(path.basename(f))}`), {
        body: await fs.openAsBlob(f),
        headers: { "content-type": "application/octet-stream" },
      });
      for (const d of r.files ?? []) log(`  ${d.status.padEnd(8)} ${d.kind} ${d.arch ?? ""} ${d.debug_id} ${d.name} [${(d.features ?? []).join(",")}]`);
      for (const s of r.skipped ?? []) log(`  skipped  ${s.name}: ${s.reason}`);
    } catch (e) {
      if (/HTTP 422/.test(e.message)) {
        skipped++; // no usable debug information: nothing to do
        continue;
      }
      failed++;
      console.error(`  FAILED   ${f}: ${e.message}`);
    }
  }
  if (skipped) log(`  ${skipped} file(s) had no usable debug information and were skipped.`);
  if (failed) fail(`${failed} upload(s) failed`);
}

// ---------- proguard ----------
async function proguard(file) {
  const uuid = flags.uuid;
  if (!uuid || !file) fail("usage: proguard --uuid <uuid> <mapping.txt>");
  if (!fs.existsSync(file)) fail(`Not found: ${file}`);
  const r = await http("PUT", projectPath(`proguard/${encodeURIComponent(uuid)}`), {
    body: await fs.openAsBlob(file),
    headers: { "content-type": "text/plain" },
  });
  log(`${r.status}: mapping ${r.uuid}${r.reprocessing ? ` (${r.reprocessing} event(s) will be reprocessed)` : ""}`);
}

// ---------- source maps ----------
const JS = /\.(m?js|cjs|bundle|jsbundle)$/i;
const DIRECTIVE = /^\s*(["'])use [\w ]+\1;?\s*$/;

/** Debug IDs are derived from the file content, so re-running gives the same ID. */
const debugIdFor = (content) => {
  const h = crypto.createHash("sha256").update(content).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
// Registers this bundle's debug ID, keyed by a stack trace that names the bundle's URL.
// The Sentry SDKs read globalThis._sentryDebugIds. Verify against the pinned SDK (api.md §5).
const snippet = (id) =>
  `;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="${id}",e._sentryDebugIdIdentifier="sentry-dbid-${id}")}catch(e){}}();`;

function mapFor(file, content) {
  const m = /\/\/[#@] sourceMappingURL=(\S+)\s*$/m.exec(content.slice(-4096));
  if (m && !m[1].startsWith("data:") && !/^[a-z]+:/i.test(m[1])) {
    const p = path.resolve(path.dirname(file), decodeURIComponent(m[1].split(/[?#]/)[0]));
    if (fs.existsSync(p)) return p;
  }
  return fs.existsSync(file + ".map") ? file + ".map" : null;
}

function inject(dir) {
  if (!dir || !fs.existsSync(dir)) fail("usage: sourcemaps inject <dir>");
  let done = 0, skipped = 0, nomap = 0;
  for (const file of walk(dir)) {
    if (!JS.test(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    if (/\/\/# debugId=[0-9a-f-]{32,36}/i.test(content.slice(-4096))) {
      skipped++;
      continue;
    }
    const mapPath = mapFor(file, content);
    if (!mapPath) {
      nomap++;
      continue;
    }
    const id = debugIdFor(content);
    const lines = content.split("\n");
    let k = 0;
    if (lines[0]?.startsWith("#!")) k = 1;
    while (k < lines.length && DIRECTIVE.test(lines[k])) k++;
    lines.splice(k, 0, snippet(id));
    let out = lines.join("\n");
    out += (out.endsWith("\n") ? "" : "\n") + `//# debugId=${id}\n`;

    const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    if (Array.isArray(map.sections)) {
      for (const s of map.sections) if (s.offset && s.offset.line >= k) s.offset.line += 1;
    } else if (typeof map.mappings === "string") {
      const segs = map.mappings.split(";");
      while (segs.length < k) segs.push("");
      segs.splice(k, 0, ""); // the inserted line maps to nothing
      map.mappings = segs.join(";");
    }
    map.debugId = id;
    map.debug_id = id;
    fs.writeFileSync(file, out);
    fs.writeFileSync(mapPath, JSON.stringify(map));
    done++;
  }
  log(`Injected ${done} file(s); ${skipped} already had a debug ID; ${nomap} without a source map left alone.`);
}

async function uploadMaps(dir) {
  if (!dir || !fs.existsSync(dir)) fail("usage: sourcemaps upload <dir> [--release R] [--dist D] [--url-prefix ~/assets]");
  const prefix = (flags["url-prefix"] ?? "~/").replace(/\/?$/, "/");
  const files = [...walk(dir)].filter((f) => JS.test(f) || /\.map$/i.test(f));
  if (!files.length) fail(`No .js or .map files in ${dir}`);
  const batches = [[]];
  let size = 0;
  for (const f of files) {
    const s = fs.statSync(f).size;
    if (size + s > 200 * 1024 * 1024 && batches.at(-1).length) {
      batches.push([]);
      size = 0;
    }
    batches.at(-1).push(f);
    size += s;
  }
  let stored = 0, exists = 0, reprocessing = 0;
  for (const batch of batches) {
    const form = new FormData();
    if (flags.release) form.append("release", flags.release);
    if (flags.dist) form.append("dist", flags.dist);
    for (const f of batch) {
      const rel = posix(path.relative(dir, f));
      form.append("url", prefix + rel);
      form.append("file", await fs.openAsBlob(f), rel);
    }
    const r = await http("POST", projectPath("sourcemaps"), { body: form });
    for (const a of r.artifacts) a.status === "stored" ? stored++ : exists++;
    reprocessing += r.reprocessing ?? 0;
  }
  const withId = files.filter((f) => /\.map$/i.test(f)).length;
  log(`Uploaded ${files.length} file(s) (${withId} map(s)): ${stored} stored, ${exists} already there.${reprocessing ? ` ${reprocessing} event(s) will be reprocessed.` : ""}`);
}

// ---------- main ----------
async function main() {
  const [cmd, sub, ...rest] = pos;
  if (flags.version) return log(VERSION);
  if (!cmd || flags.help || flags.h) return log(HELP);
  if (cmd === "whoami") return whoami();
  if (cmd === "debug-files") return debugFiles([sub, ...rest].filter(Boolean));
  if (cmd === "proguard") return proguard(sub);
  if (cmd === "sourcemaps" && sub === "inject") return inject(rest[0]);
  if (cmd === "sourcemaps" && sub === "upload") return uploadMaps(rest[0]);
  fail(`Unknown command. Run with --help.`);
}

main().catch((e) => {
  const msg = e instanceof Fail ? e.message : e.stack ?? String(e);
  if (flags.soft) {
    console.warn(`crash-upload: WARNING (soft): ${msg}`);
    process.exit(0);
  }
  console.error(`crash-upload: ERROR: ${msg}`);
  process.exit(1);
});
