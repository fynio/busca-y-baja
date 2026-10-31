// Local copyright-free music aggregator (two search engines):
//   1. ccMixter   - open JSON API, no key needed, direct MP3 download URLs
//   2. Openverse  - aggregates Jamendo, Free Music Archive, Freesound, Wikimedia...
//                   anonymous access is rate limited; set openverseKey in
//                   config.json (free key from https://api.openverse.org) to lift it.
// Zero dependencies. Run: node server.js

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");

const PORT = process.env.PORT ? Number(process.env.PORT) : 5177;
const ROOT = __dirname;
const MUSIC_DIR = path.join(ROOT, "music");
const STATIC_DIR = path.join(ROOT, "public");

if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // url -> { at, body }

// --- helpers -------------------------------------------------------------

function sendJson(res, status, data) {
  if (res.headersSent) {
    // stream/headers already sent (e.g. client aborted mid-download): nothing to send
    try { res.end(); } catch {}
    return;
  }
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
  } catch {
    return {};
  }
}

function safeName(name) {
  const clean = String(name || "track")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, "")
    .replace(/([_-])\1+/g, "$1")
    .trim()
    .slice(0, 120);
  return clean || "track";
}

function dedupeFilename(dir, base, ext) {
  let candidate = `${base}${ext}`;
  let i = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${i})${ext}`;
    i += 1;
  }
  return candidate;
}

function extFromUrl(url, filetype) {
  if (filetype && /^[a-z0-9]{1,5}$/i.test(filetype)) return `.${filetype.toLowerCase()}`;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-z0-9]{1,5})$/i);
    if (m) return `.${m[1].toLowerCase()}`;
  } catch {}
  return ".mp3";
}

// Block obvious private-network targets (basic SSRF guard for a local tool).
function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "0.0.0.0" ||
      host === "[::1]"
    ) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function fetchUpstream(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers, maxHeaderSize: 256 * 1024 }, (up) => resolve(up));
    req.on("error", reject);
    req.end();
    req.setTimeout(30000, () => req.destroy(new Error("upstream timeout")));
  });
}

// ccMixter 403s plain requests for its /content/ files; a ccmixter.org Referer
// (plus a browser-ish UA) is required. Other hosts ignore these headers.
function upstreamHeaders(extra = {}) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://ccmixter.org/",
    ...extra,
  };
}

async function fetchedJson(url, headers) {
  const up = await fetchUpstream(url, headers);
  const chunks = [];
  let size = 0;
  for await (const c of up) {
    chunks.push(c);
    size += c.length;
    if (size > 10 * 1024 * 1024) break;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function fetchedJsonCached(url, headers) {
  const seen = cache.get(url);
  if (seen && Date.now() - seen.at < CACHE_TTL_MS) return seen.body;
  const body = await fetchedJson(url, headers);
  cache.set(url, { at: Date.now(), body });
  return body;
}

// Retry once on a fresh socket: upstreams occasionally stall.
async function fetchedJsonResilient(url, headers) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchedJsonCached(url, headers);
    } catch (err) {
      lastErr = err;
      cache.delete(url);
    }
  }
  throw lastErr;
}

// license_name ("Attribution Noncommercial (4.0)") -> short CC slug
function ccmixterLicense(info) {
  const name = (info?.license_name || "").toLowerCase();
  const url = (info?.license_url || "").toLowerCase();
  const m = url.match(/licenses\/([a-z-]+)\/([\d.]+)/);
  if (m) return `${m[1]} ${m[2]}`;
  const parts = [];
  if (name.includes("attribution")) parts.push("by");
  if (name.includes("noncommercial")) parts.push("nc");
  if (name.includes("share") || url.includes("share-")) parts.push("sa");
  const v = url.match(/(\d\.\d)\/?$/);
  return (parts.join("-") + (v ? ` ${v[1]}` : "")) || name || "—";
}

// "4:06" or "1:02:03" -> ms
function psToMs(ps) {
  if (!ps) return null;
  const s = String(ps).split(":").map(Number);
  if (s.some((n) => Number.isNaN(n))) return null;
  return s.reduce((acc, n) => acc * 60 + n, 0) * 1000;
}

// --- engines -------------------------------------------------------------

// Wikimedia Commons: https://commons.wikimedia.org/w/api.php (open, no key)
// Openverse tarpits anonymous traffic, so the Wikimedia chip bypasses it.
async function searchCommons(query, res) {
  const text = [(query.get("q") || "").trim(), (query.get("genre") || "").trim()]
    .filter(Boolean)
    .join(" ");
  const s = text ? `${text} filetype:audio` : "incategory:Music files filetype:audio";
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: s,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params}`;
  try {
    const body = await fetchedJsonResilient(url, { "User-Agent": "local-music-aggregator/1.0" });
    const pages = Object.values(body?.query?.pages || {});
    if (!pages.length) {
      console.error("[commons] no pages:", url, JSON.stringify(body).slice(0, 300));
    }
    const results = pages.map((p) => {
      // pages appear before imageinfo sometimes (generator order race)
      const ii = (p.imageinfo || [])[0] || {};
      const meta = ii.extmetadata || {};
      const stripHtml = (x) => {
        // extmetadata values come as { value, source, hidden } sometimes
        const raw = typeof x === "object" && x !== null ? x.value : x;
        return String(raw ?? "").replace(/<[^>]*>/g, "").trim();
      };
      const li = stripHtml(meta.LicenseShortName) || "—";
      const clean = /^0/.test(li) ? "CC0" : li.replace(/^cc\s*/i, "");
      return {
        id: `wm-${p.pageid}`,
        title: (p.title || "").replace(/^File:/, ""),
        creator: stripHtml(meta.Artist) || "—",
        url: (ii.url || "").split("?")[0], // commons appends utm_* tracking params
        license: clean,
        source: "wikimedia",
        duration: ii.duration ? Math.round(Number(ii.duration) * 1000) : null,
        filesize: ii.size ? Number(ii.size) : null,
        thumbnail: "",
        landingUrl: ii.descriptionurl || "",
      };
    }).filter((r) => r.url && /\.(mp3|ogg|oga|flac|wav|m4a)$/i.test(r.url));
    sendJson(res, 200, { engine: "commons", results });
  } catch (err) {
    sendJson(res, 502, {
      error: "search_failed",
      engine: "commons",
      detail: String(err.message || err),
    });
  }
}

// Internet Archive (netlabels): free music collections, open API, no key.
// FMA was dropped from Openverse (invalid 'fma' source) — IA netlabels cover it.
const IA_FILE_RE = /\.(mp3|ogg|)$/i; // url path may lack extension; readable/{file}
async function iaPickFile(id) {
  try {
    const meta = await fetchedJsonCached(`https://archive.org/metadata/${encodeURIComponent(id)}`, {
      "User-Agent": "local-music-aggregator/1.0",
    });
    const files = meta?.files || [];
    const audio = files.filter((f) => /\.(mp3|ogg)$/i.test(f.name || ""));
    if (!audio.length) return null;
    const pick =
      audio.find((f) => f.format === "VBR MP3") ||
      audio.find((f) => f.format === "MP3") ||
      audio[0];
    const secs = String(pick.length || meta.length || "").match(/^[\d.]+$/)
      ? Number(String(pick.length || meta.length)) * 1000
      : null;
    const license = (meta?.metadata?.licenseurl || "")
      .toLowerCase()
      .match(/licenses\/([a-z-]+)\/([\d.]+)/);
    return {
      url: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(pick.name)}`,
      duration: secs,
      license: license ? `${license[1]} ${license[2]}` : "by (netlabels)",
      landing: `https://archive.org/details/${id}`,
    };
  } catch (err) {
    console.error(`[ia] metadata ${id} failed:`, err.message);
    return null;
  }
}

async function searchIA(query, res) {
  const text = [(query.get("q") || "").trim(), (query.get("genre") || "").trim()]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({
    q: `collection:netlabels AND mediatype:audio AND format:("VBR MP3")${text ? " AND " + text : ""}`,
    rows: "20",
    output: "json",
  });
  params.append("fl[]", "identifier");
  params.append("fl[]", "title");
  params.append("fl[]", "creator");
  const url = `https://archive.org/advancedsearch.php?${params}`;
  try {
    const body = await fetchedJsonResilient(url, { "User-Agent": "local-music-aggregator/1.0" });
    const docs = body?.response?.docs || [];
    if (!docs.length) {
      console.error("[ia] no docs:", url, JSON.stringify(body).slice(0, 300));
    }
    const settled = await Promise.all(docs.map((d) => iaPickFile(d.identifier)));
    const results = docs
      .map((d, i) => ({ d, f: settled[i] }))
      .filter(({ f }) => f)
      .map(({ d, f }) => ({
        id: `ia-${d.identifier}`,
        title: (d.title || d.identifier).replace(/^Disc \d+ /i, ""),
        creator: Array.isArray(d.creator) ? d.creator[0] : d.creator || "—",
        url: f.url,
        license: f.license,
        source: "internetarchive",
        duration: f.duration,
        filesize: null,
        thumbnail: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
        landingUrl: f.landing,
      }));
    sendJson(res, 200, { engine: "ia", results });
  } catch (err) {
    sendJson(res, 502, {
      error: "search_failed",
      engine: "ia",
      detail: String(err.message || err),
    });
  }
}

// Openverse: https://api.openverse.org/v1/audio/
// Anonymous use is throttled (tarpit): serialize calls + retry with backoff.
let ovChain = Promise.resolve();
function ovQueued(task) {
  const run = ovChain.then(() => task());
  ovChain = run.catch(() => {});
  return run;
}

async function searchOpenverse(query, res) {
  const attempt = async () => {
    const text = [(query.get("q") || "").trim(), (query.get("genre") || "").trim()]
      .filter(Boolean)
      .join(" ");
    const params = new URLSearchParams({ page_size: "20", category: "music" });
    if (text) params.set("q", text);
    const source = (query.get("source") || "").trim();
    if (source) params.set("source", source);
    const licenseType = (query.get("license_type") || "").trim();
    if (licenseType) params.set("license_type", licenseType);

    const url = `https://api.openverse.org/v1/audio/?${params}`;
    const cfg = readConfig();
    const key = cfg.openverseKey || process.env.OPENVERSE_KEY;
    const headers = { "User-Agent": "local-music-aggregator/1.0" };
    if (key) headers.Authorization = `Bearer ${key}`;

    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        const body = await fetchedJsonCached(url, headers);
        return body;
      } catch (e) {
        lastErr = e;
        cache.delete(url);
        await new Promise((r) => setTimeout(r, (i + 1) * 3000)); // backoff 3s/6s
      }
    }
    throw lastErr;
  };

  try {
    const body = await ovQueued(attempt);
    const results = (body.results || []).map((t) => ({
      id: `ov-${t.id}`,
      title: t.title || "Sin título",
      creator: t.creator || "—",
      url: t.url,
      license: `${t.license || ""}${t.license_version ? ` ${t.license_version}` : ""}`.trim(),
      source: t.source || t.provider || "openverse",
      duration: t.duration || null,
      filesize: t.filesize || null,
      thumbnail: t.thumbnail || "",
      landingUrl: t.foreign_landing_url || "",
    }));
    sendJson(res, 200, { engine: "openverse", results, rateLimited: !readConfig().openverseKey });
  } catch (err) {
    sendJson(res, 502, {
      error: "search_failed",
      engine: "openverse",
      rateLimited: !readConfig().openverseKey,
      detail: String(err.message || err),
    });
  }
}

// ccMixter: https://ccmixter.org/api/query?f=json&search=...&tags=...&limit=20
async function searchCcmixter(query, res) {
  const params = new URLSearchParams({ f: "json", limit: "20" });
  const q = (query.get("q") || "").trim();
  if (q) params.set("search", q);
  const tags = (query.get("genre") || "").trim();
  if (tags) params.set("tags", tags);
  const url = `https://ccmixter.org/api/query?${params}`;
  try {
    const body = await fetchedJsonResilient(url, { "User-Agent": "local-music-aggregator/1.0" });
    const results = (body || []).map((t) => {
      const file = (t.files || [])[0] || {};
      const fmt = file.file_format_info || {};
      return {
        id: `cc-${t.upload_id}`,
        title: t.upload_name || "Sin título",
        creator: t.user_real_name || t.user_name || "—",
        url: file.download_url || t.file_page_url,
        license: ccmixterLicense(t),
        source: "ccmixter",
        duration: psToMs(fmt.ps),
        filesize: file.file_rawsize ? Number(file.file_rawsize) : null,
        thumbnail: "",
        landingUrl: t.file_page_url || "",
      };
    });
    sendJson(res, 200, { engine: "ccmixter", results });
  } catch (err) {
    sendJson(res, 502, {
      error: "search_failed",
      engine: "ccmixter",
      detail: String(err.message || err),
    });
  }
}

// --- routes --------------------------------------------------------------

async function handleSearch(req, res, query) {
  const engine = query.get("engine") || "ccmixter";
  if (engine === "openverse") return searchOpenverse(query, res);
  if (engine === "ccmixter") return searchCcmixter(query, res);
  if (engine === "commons") return searchCommons(query, res);
  if (engine === "ia") return searchIA(query, res);
  sendJson(res, 400, { error: "bad_engine" });
}

async function handleStream(req, res, query) {
  const target = isAllowedUrl(query.get("url") || "");
  if (!target) return sendJson(res, 400, { error: "bad_url" });

  try {
    const headers = upstreamHeaders();
    const range = req.headers.range;
    if (range) headers.Range = range;

    const up = await fetchUpstream(target.toString(), headers);
    if (up.statusCode >= 300) {
      res.writeHead(up.statusCode);
      return res.end();
    }

    res.writeHead(up.statusCode === 206 ? 206 : 200, {
      "Content-Type": up.headers["content-type"] || "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      ...(up.headers["content-length"] ? { "Content-Length": up.headers["content-length"] } : {}),
      ...(up.headers["content-range"] ? { "Content-Range": up.headers["content-range"] } : {}),
    });
    if (req.method === "HEAD") return res.end();
    await pipeline(up, res);
  } catch (err) {
    sendJson(res, 502, { error: "stream_failed", detail: String(err.message || err) });
  }
}

async function handleDownload(req, res, query) {
  const target = isAllowedUrl(query.get("url") || "");
  if (!target) return sendJson(res, 400, { error: "bad_url" });

  try {
    const up = await fetchUpstream(target.toString(), upstreamHeaders());
    if (up.statusCode >= 300) {
      return sendJson(res, 502, { error: "download_redirect", status: up.statusCode });
    }

    const base = safeName(query.get("name") || "track");
    const ext = extFromUrl(target.toString(), query.get("filetype") || "");
    const filename = dedupeFilename(MUSIC_DIR, base, ext);
    const dest = path.join(MUSIC_DIR, filename);

    let bytes = 0;
    up.on("data", (c) => (bytes += c.length));
    await pipeline(up, fs.createWriteStream(dest));
    sendJson(res, 200, { ok: true, file: filename, bytes });
  } catch (err) {
    sendJson(res, 502, { error: "download_failed", detail: String(err.message || err) });
  }
}

function handleList(res) {
  try {
    const files = fs
      .readdirSync(MUSIC_DIR)
      .filter((f) => /\.(mp3|ogg|wav|flac|m4a)$/i.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(MUSIC_DIR, f));
        return { name: f, bytes: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    sendJson(res, 200, { files });
  } catch (err) {
    sendJson(res, 500, { error: "list_failed", detail: String(err.message || err) });
  }
}

function handleDelete(res, query) {
  const name = path.basename(query.get("name") || "");
  const target = path.join(MUSIC_DIR, name);
  try {
    if (!fs.existsSync(target)) return sendJson(res, 404, { error: "not_found" });
    fs.unlinkSync(target);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: "delete_failed", detail: String(err.message || err) });
  }
}

// --- static + dispatch ---------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname, searchParams } = url;

  (async () => {
    if (pathname === "/api/search") return handleSearch(req, res, searchParams);
    if (pathname === "/api/stream") return handleStream(req, res, searchParams);
    if (pathname === "/api/download") return handleDownload(req, res, searchParams);
    if (pathname === "/api/files") return handleList(res);
    if (pathname === "/api/delete") return handleDelete(res, searchParams);

    let rel = pathname === "/" ? "/index.html" : pathname;
    const file = path.join(STATIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(STATIC_DIR)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  })().catch((err) => sendJson(res, 500, { error: "internal", detail: String(err) }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Music aggregator on http://localhost:${PORT}`);
});
