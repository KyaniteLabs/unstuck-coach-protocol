#!/usr/bin/env node
// Verifies that every URL this repository advertises actually resolves.
//
// Advertised URLs are read from the repository's own files:
//   llms.txt        every absolute URL
//   sitemap.xml     every <loc>
//   robots.txt      every "Sitemap:" line
//   landing/*.html  <link rel="canonical">, Open Graph and Twitter card meta
//                   tags, and URL values inside JSON-LD blocks
//
// Each URL is then requested with one anonymous GET (no token, no cookies, no
// repository setting is touched) and the exit code reports the outcome:
//   0  every advertised URL resolves
//   1  at least one advertised URL does not resolve, or a source file
//      advertises something that is not an absolute http(s) URL
//   2  the script was invoked with arguments it does not understand
//
//   node scripts/verify-advertised-urls.mjs
//   node scripts/verify-advertised-urls.mjs --base-url http://127.0.0.1:4173
//   node scripts/verify-advertised-urls.mjs --json
//
// --base-url ORIGIN runs the same checks against a fixed target: every
// advertised URL is requested from ORIGIN with its path unchanged, so a local
// or preview copy of this folder can be shown to satisfy what the repository
// advertises. scripts/verify-advertised-urls-test.mjs proves both outcomes
// against loopback fixtures only.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const requestTimeoutMs = 15000;
const requestConcurrency = 6;
const userAgent = "unstuck-coach-protocol-advertised-url-check";

// Root files that advertise URLs.
const discoveryFiles = ["llms.txt", "sitemap.xml", "robots.txt"];
const landingPagePattern = /^landing\/[^/]+\.html$/;

// Open Graph / Twitter card keys whose content is always a URL.
const alwaysUrlMetaKeys = new Set([
  "og:url",
  "og:image",
  "og:image:secure_url",
  "og:image:url",
  "og:video",
  "og:video:secure_url",
  "og:video:url",
  "og:audio",
  "og:audio:secure_url",
  "og:audio:url",
  "twitter:url",
  "twitter:image",
  "twitter:image:src",
  "twitter:player",
  "twitter:player:stream",
]);

// JSON-LD keys whose string value is always a URL.
const alwaysUrlJsonLdKeys = new Set(["url", "@id", "image", "logo", "sameAs"]);

function isAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname !== ""
    );
  } catch {
    return false;
  }
}

// True when a meta or JSON-LD value is written like a URL reference, so a
// relative or protocol-relative one is reported instead of silently skipped.
function looksLikeUrlReference(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\.\/)/i.test(value.trim());
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(
    /&(#[0-9]+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi,
    (entity, body) => {
      if (body[0] !== "#") return named[body.toLowerCase()];
      const code =
        body[1].toLowerCase() === "x"
          ? Number.parseInt(body.slice(2), 16)
          : Number(body.slice(1));
      return code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : entity;
    },
  );
}

function parseAttributes(text) {
  const attributes = {};
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of text.matchAll(pattern)) {
    const value = match[2] ?? match[3] ?? match[4];
    attributes[match[1].toLowerCase()] =
      value === undefined ? "" : decodeEntities(value);
  }
  return attributes;
}

// Drops trailing sentence punctuation, and any closing parenthesis that is not
// opened inside the URL itself (Markdown links wrap URLs in parentheses).
function trimUrl(raw) {
  let url = raw.replace(/[.,;:!?]+$/, "");
  while (
    url.endsWith(")") &&
    (url.match(/\)/g) ?? []).length > (url.match(/\(/g) ?? []).length
  ) {
    url = url.slice(0, -1).replace(/[.,;:!?]+$/, "");
  }
  return url;
}

function extractTextUrls(file, content, accept) {
  for (const match of content.matchAll(/https?:\/\/[^\s<>"'`\\]+/g)) {
    accept(trimUrl(match[0]), file, lineOf(content, match.index), "");
  }
}

function extractSitemapUrls(file, content, accept) {
  for (const match of content.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)) {
    accept(
      decodeEntities(match[1]),
      file,
      lineOf(content, match.index),
      "",
    );
  }
}

function extractRobotsUrls(file, content, accept) {
  content.split(/\r?\n/).forEach((text, index) => {
    const match = text.match(/^\s*sitemap\s*:\s*(\S+)/i);
    if (match) accept(match[1], file, index + 1, "");
  });
}

function visitJsonLd(value, visit, key = "") {
  if (typeof value === "string") {
    if (alwaysUrlJsonLdKeys.has(key)) {
      if (value.trim() !== "") visit(key, value);
    } else if (looksLikeUrlReference(value)) {
      visit(key, value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visitJsonLd(item, visit, key);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [name, item] of Object.entries(value)) {
    // @context names a vocabulary; it is not an advertisement.
    if (name === "@context") continue;
    visitJsonLd(item, visit, name);
  }
}

function extractLandingUrls(file, html, accept, reject) {
  const jsonLdBlocks = [];
  // Comments and script bodies are blanked out (newlines kept, so line numbers
  // stay true) before the tags are read, so a commented-out tag is not an
  // advertisement and a script body cannot swallow the tags that follow it.
  const markup = html.replace(
    /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    (block, attributes = "", body = "", index) => {
      if (
        !block.startsWith("<!--") &&
        /\btype\s*=\s*["']?application\/ld\+json\b/i.test(attributes)
      ) {
        jsonLdBlocks.push({ body, line: lineOf(html, index) });
      }
      return block.replace(/[^\n]/g, " ");
    },
  );

  for (const match of markup.matchAll(/<(link|meta)\b([^>]*?)>/gi)) {
    const attributes = parseAttributes(match[2]);
    const line = lineOf(markup, match.index);
    if (match[1].toLowerCase() === "link") {
      const rel = (attributes.rel ?? "").toLowerCase().split(/\s+/);
      if (rel.includes("canonical")) {
        accept(attributes.href ?? "", file, line, "canonical");
      }
      continue;
    }
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    if (!/^(?:og|twitter):/.test(key)) continue;
    if (alwaysUrlMetaKeys.has(key)) {
      if (attributes.content !== "") {
        accept(attributes.content ?? "", file, line, key);
      }
    } else if (looksLikeUrlReference(attributes.content ?? "")) {
      accept(attributes.content, file, line, key);
    }
  }

  for (const block of jsonLdBlocks) {
    let parsed;
    try {
      parsed = JSON.parse(block.body);
    } catch (error) {
      reject(
        `${file}:${block.line} has a JSON-LD block that is not valid JSON (${error.message}), so the URLs it advertises cannot be read.`,
      );
      continue;
    }
    visitJsonLd(parsed, (key, value) =>
      accept(value, file, block.line, `json-ld ${key}`),
    );
  }
}

// `files` is a list of { file, content } entries. A content of null means the
// file could not be read, which is reported instead of skipped.
export function extractAdvertisedUrls(files) {
  const advertised = new Map();
  const failures = [];

  function accept(value, file, line, tag) {
    const url = value.trim();
    if (!isAbsoluteHttpUrl(url)) {
      failures.push(
        `${file}:${line} advertises "${url}"${tag ? ` as ${tag}` : ""}, which is not an absolute http(s) URL.`,
      );
      return;
    }
    const entry = advertised.get(url) ?? { url, sources: [] };
    const source = { file, line, tag };
    if (
      !entry.sources.some(
        (known) =>
          known.file === source.file &&
          known.line === source.line &&
          known.tag === source.tag,
      )
    ) {
      entry.sources.push(source);
    }
    advertised.set(url, entry);
  }

  for (const { file, content } of files) {
    if (content === null) {
      failures.push(
        `${file} could not be read, so the URLs it advertises cannot be checked.`,
      );
    }
    const text = content ?? "";
    if (file === "llms.txt") {
      extractTextUrls(file, text, accept);
    } else if (file === "sitemap.xml") {
      extractSitemapUrls(file, text, accept);
    } else if (file === "robots.txt") {
      extractRobotsUrls(file, text, accept);
    } else if (landingPagePattern.test(file)) {
      extractLandingUrls(file, text, accept, (message) =>
        failures.push(message),
      );
    } else {
      throw new Error(`${file} is not a source of advertised URLs.`);
    }
  }
  if (!files.some(({ file }) => landingPagePattern.test(file))) {
    failures.push(
      "landing/ has no HTML page, so the URLs it advertises cannot be read.",
    );
  }

  const urls = [...advertised.values()].sort((a, b) =>
    a.url < b.url ? -1 : a.url > b.url ? 1 : 0,
  );
  return { urls, failures };
}

export function collectAdvertisedUrls(root = process.cwd()) {
  function readSource(file) {
    try {
      return fs.readFileSync(path.join(root, file), "utf8");
    } catch {
      return null;
    }
  }

  const files = discoveryFiles.map((file) => ({
    file,
    content: readSource(file),
  }));
  const landingPath = path.join(root, "landing");
  let landingNames = [];
  try {
    landingNames = fs
      .readdirSync(landingPath)
      .filter(
        (name) =>
          name.endsWith(".html") &&
          fs.statSync(path.join(landingPath, name)).isFile(),
      )
      .sort();
  } catch {
    landingNames = [];
  }
  files.push(
    ...landingNames.map((name) => ({
      file: `landing/${name}`,
      content: readSource(`landing/${name}`),
    })),
  );

  return extractAdvertisedUrls(files);
}

// With a base URL every advertised URL is requested from that origin with its
// path, query, and fragment unchanged; without one it is requested as written.
export function retargetUrl(url, baseUrl = "") {
  if (!baseUrl) return url;
  const target = new URL(url);
  return new URL(`${target.pathname}${target.search}${target.hash}`, baseUrl)
    .href;
}

function describeError(error, timeoutMs) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return `no response within ${timeoutMs} ms`;
  }
  const code = typeof error?.cause?.code === "string" ? ` (${error.cause.code})` : "";
  return `${error?.message ?? String(error)}${code}`;
}

async function requestUrl(entry, { baseUrl, timeoutMs }) {
  const target = retargetUrl(entry.url, baseUrl);
  const result = {
    url: entry.url,
    target,
    resolved: false,
    status: null,
    finalUrl: target,
    contentType: "",
    error: "",
    sources: entry.sources,
  };
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "follow",
      // Node's fetch keeps no cookie jar; "omit" states the intent for a
      // runtime that does. No credential of any kind is attached.
      credentials: "omit",
      headers: { accept: "*/*", "user-agent": userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    });
    result.status = response.status;
    result.finalUrl = response.url || target;
    result.contentType = response.headers.get("content-type") ?? "";
    result.resolved = response.status >= 200 && response.status < 300;
    await response.body?.cancel().catch(() => {});
  } catch (error) {
    result.error = describeError(error, timeoutMs);
  }
  return result;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run),
  );
  return results;
}

function formatSource({ file, line, tag }) {
  return tag ? `${file}:${line} ${tag}` : `${file}:${line}`;
}

function describeResult(result) {
  const reason = result.status === null ? result.error : `HTTP ${result.status}`;
  return `${result.url} does not resolve (${reason}); advertised by ${result.sources
    .map(formatSource)
    .join(", ")}.`;
}

export async function verifyAdvertisedUrls({
  root = process.cwd(),
  baseUrl = "",
  timeoutMs = requestTimeoutMs,
} = {}) {
  const collected = collectAdvertisedUrls(root);
  const sourceProblems = [...collected.failures];
  if (collected.urls.length === 0) {
    sourceProblems.push(
      "No advertised URL was found in llms.txt, sitemap.xml, robots.txt, or landing/*.html.",
    );
  }
  const results = await mapWithConcurrency(collected.urls, requestConcurrency, (
    entry,
  ) => requestUrl(entry, { baseUrl, timeoutMs }));
  const failures = [...sourceProblems];
  for (const result of results) {
    if (!result.resolved) failures.push(describeResult(result));
  }
  const unresolved = results.filter((result) => !result.resolved).length;
  return {
    status: failures.length === 0 ? "pass" : "fail",
    mode: baseUrl ? "base-url" : "live",
    baseUrl,
    total: results.length,
    resolved: results.length - unresolved,
    unresolved,
    results,
    sourceProblems,
    failures,
  };
}

function formatReport(summary) {
  const lines = [];
  if (summary.status === "pass") {
    lines.push(`PASS: all ${summary.total} advertised URLs resolve.`);
  } else {
    const sourceProblemCount = summary.sourceProblems.length;
    lines.push(
      `FAIL: ${summary.unresolved} of ${summary.total} advertised URLs do not resolve` +
        (sourceProblemCount > 0
          ? `; ${sourceProblemCount} source problem${sourceProblemCount === 1 ? "" : "s"}`
          : "") +
        ".",
    );
  }
  lines.push(
    `mode: ${summary.mode}` +
      (summary.baseUrl
        ? ` (every URL requested from ${summary.baseUrl} with its path unchanged)`
        : " (each URL requested as written)"),
  );
  for (const result of summary.results) {
    const reason =
      result.status === null ? result.error : `HTTP ${result.status}`;
    lines.push(`${result.resolved ? "OK  " : "FAIL"}  ${result.url}  ${reason}`);
    if (result.target !== result.url) {
      lines.push(`       requested ${result.target}`);
    }
    if (result.finalUrl !== result.target) {
      lines.push(`       final     ${result.finalUrl}`);
    }
    lines.push(
      `       advertised by ${result.sources.map(formatSource).join(", ")}`,
    );
  }
  for (const problem of summary.sourceProblems) {
    lines.push(`PROBLEM  ${problem}`);
  }
  return lines.join("\n");
}

function usage(message = "") {
  const text = [
    "usage: node scripts/verify-advertised-urls.mjs [--base-url ORIGIN] [--json]",
    "",
    "Requests every URL the repository advertises (llms.txt, sitemap.xml,",
    "robots.txt, and the canonical, Open Graph, Twitter card, and JSON-LD tags",
    "in landing/) with an anonymous GET and reports whether each one resolves.",
    "",
    "  --base-url ORIGIN  request every advertised URL from ORIGIN with its path unchanged",
    "  --json             print the machine-readable summary instead of the report",
    "  -h, --help         print this text",
    "",
    "exit codes: 0 all advertised URLs resolve; 1 at least one does not (or a",
    "            source file advertises something that is not an absolute",
    "            http(s) URL); 2 usage error",
  ].join("\n");
  return message ? `${message}\n\n${text}` : text;
}

function normalizeBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`--base-url needs an origin such as http://127.0.0.1:4173, not "${value}".`);
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `--base-url needs a bare origin such as http://127.0.0.1:4173 (no path, query, or fragment), not "${value}".`,
    );
  }
  return parsed.origin;
}

function parseArgs(argv) {
  const options = { baseUrl: "", json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--base-url" || arg.startsWith("--base-url=")) {
      const value = arg === "--base-url" ? argv[index + 1] : arg.slice("--base-url=".length);
      if (arg === "--base-url") index += 1;
      if (value === undefined) {
        throw new Error("--base-url needs an origin such as http://127.0.0.1:4173.");
      }
      options.baseUrl = normalizeBaseUrl(value);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${usage(error.message)}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const summary = await verifyAdvertisedUrls({ baseUrl: options.baseUrl });
  process.stdout.write(
    `${options.json ? JSON.stringify(summary, null, 2) : formatReport(summary)}\n`,
  );
  return summary.status === "pass" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error?.stack ?? error}\n`);
      process.exitCode = 2;
    },
  );
}
