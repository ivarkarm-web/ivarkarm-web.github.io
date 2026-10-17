/**
 * Pionier community-song API for Cloudflare Workers.
 *
 * Configure secrets:
 *   GITHUB_TOKEN   fine-grained token, Contents: Read and write, this repo only
 * Configure variables:
 *   ALLOWED_ORIGIN = https://ivarkarm-web.github.io
 *   REPO_OWNER = ivarkarm-web
 *   REPO_NAME = ivarkarm-web.github.io
 *   REPO_BRANCH = main
 *
 * Routes:
 *   GET  /songs  -> public community song list
 *   POST /songs  -> validate and commit WAV + metadata
 */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const SONGS_DIR = "handpan-app/community-songs";
const memoryRate = new Map();

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "access-control-max-age": "86400",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
function slug(value) {
  return String(value || "song").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "song";
}
function b64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(out);
}
function config(env) {
  if (!env.GITHUB_TOKEN || !env.REPO_OWNER || !env.REPO_NAME) throw new Error("Server is not configured.");
  return { owner: env.REPO_OWNER, repo: env.REPO_NAME, branch: env.REPO_BRANCH || "main" };
}
async function github(path, env, options = {}) {
  const c = config(env);
  const response = await fetch("https://api.github.com/repos/" + c.owner + "/" + c.repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/"), {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + env.GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Pionier-Community-Songs",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error("Repository request failed (" + response.status + "): " + details.slice(0, 180));
  }
  return response.json();
}
async function createFile(path, bytes, message, env, contentType = "application/octet-stream") {
  const c = config(env);
  return github(path, env, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: b64(bytes), branch: c.branch })
  });
}
async function listSongs(request, env, origin) {
  const c = config(env);
  let files;
  try {
    files = await github(SONGS_DIR, env);
  } catch (error) {
    // GitHub returns 404 for an empty, not-yet-created directory.
    if (!String(error.message).includes("(404)")) throw error;
    return json({ songs: [] }, 200, origin);
  }
  const metadataFiles = (Array.isArray(files) ? files : []).filter(f => f.type === "file" && f.name.endsWith(".json")).slice(0, 250);
  const songs = await Promise.all(metadataFiles.map(async file => {
    try {
      const metaResponse = await fetch(file.download_url, { headers: { "Accept": "application/vnd.github.raw+json" } });
      if (!metaResponse.ok) return null;
      const meta = await metaResponse.json();
      if (!meta || typeof meta.title !== "string" || typeof meta.audioFile !== "string") return null;
      const audioFile = meta.audioFile.replace(/[^a-zA-Z0-9._-]/g, "");
      if (!audioFile.endsWith(".wav")) return null;
      return {
        id: file.name.replace(/\.json$/i, ""),
        title: meta.title.slice(0, 80),
        creator: String(meta.creator || "Pionier player").slice(0, 40),
        createdAt: meta.createdAt || "",
        durationSeconds: Math.max(0, Number(meta.durationSeconds) || 0),
        audioUrl: "https://raw.githubusercontent.com/" + c.owner + "/" + c.repo + "/" + c.branch + "/" + SONGS_DIR + "/" + encodeURIComponent(audioFile)
      };
    } catch (_) { return null; }
  }));
  songs.sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
  return json({ songs: songs.filter(Boolean) }, 200, origin);
}
async function submitSong(request, env, origin) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const prior = memoryRate.get(ip) || 0;
  if (now - prior < 45_000) return json({ error: "Please wait a moment before submitting another song." }, 429, origin);
  const form = await request.formData();
  if (String(form.get("website") || "").trim()) return json({ error: "Submission rejected." }, 400, origin); // honeypot
  const title = String(form.get("title") || "").trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 80);
  const creator = String(form.get("creator") || "").trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 40) || "Pionier player";
  const audio = form.get("audio");
  const duration = Number(form.get("duration") || 0);
  if (!title) return json({ error: "Add a song title." }, 400, origin);
  if (!(audio instanceof File) || audio.size < 44 || audio.size > MAX_AUDIO_BYTES) {
    return json({ error: "Audio must be a WAV file under 8 MB. Try a shorter recording." }, 413, origin);
  }
  const head = new Uint8Array(await audio.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...head.slice(0, 4)) !== "RIFF" || String.fromCharCode(...head.slice(8, 12)) !== "WAVE") {
    return json({ error: "Only WAV audio is accepted." }, 415, origin);
  }
  const c = config(env);
  const id = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + crypto.randomUUID().slice(0, 8);
  const base = slug(title) + "-" + id;
  const audioFile = base + ".wav";
  const metadataFile = base + ".json";
  const createdAt = new Date().toISOString();
  const bytes = new Uint8Array(await audio.arrayBuffer());
  // Best-effort isolate-local throttling; configure Cloudflare rate limiting for durable edge enforcement.
  memoryRate.set(ip, now);
  for (const [key, time] of memoryRate) if (now - time > 120_000) memoryRate.delete(key);
  try {
    await createFile(SONGS_DIR + "/" + audioFile, bytes, "Add community song: " + title, env);
    const metadata = new TextEncoder().encode(JSON.stringify({
      title, creator, audioFile, format: "wav",
      durationSeconds: Math.round(Math.max(0, Math.min(600, duration)) * 1000) / 1000,
      createdAt, source: "Pionier Community Song"
    }, null, 2) + "\n");
    await createFile(SONGS_DIR + "/" + metadataFile, metadata, "Add community song metadata: " + title, env);
    return json({ ok: true, song: { id: base, title, creator, createdAt, durationSeconds: duration, audioUrl: "https://raw.githubusercontent.com/" + c.owner + "/" + c.repo + "/" + c.branch + "/" + SONGS_DIR + "/" + encodeURIComponent(audioFile) } }, 201, origin);
  } catch (error) {
    return json({ error: "Could not save the song. " + String(error.message || "").slice(0, 220) }, 502, origin);
  }
}
export default {
  async fetch(request, env) {
    const expected = env.ALLOWED_ORIGIN || "https://ivarkarm-web.github.io";
    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== expected) return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": expected,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "access-control-max-age": "86400"
    }});
    const url = new URL(request.url);
    if (url.pathname.replace(/\/$/, "") !== "/songs") return json({ error: "Not found" }, 404, expected);
    try {
      if (request.method === "GET") return await listSongs(request, env, expected);
      if (request.method === "POST") return await submitSong(request, env, expected);
      return json({ error: "Method not allowed" }, 405, expected);
    } catch (error) {
      return json({ error: String(error.message || "Server error").slice(0, 240) }, 500, expected);
    }
  }
};
