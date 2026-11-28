#!/usr/bin/env node
// Proves that scripts/verify-advertised-urls.mjs reports PASS as well as FAIL.
//
// Every target here is a loopback fixture that this file starts and stops;
// nothing is requested from the network. The two end-to-end cases are the two
// states the repository can be in:
//   serving this folder    the advertised paths serve this repository's own
//                          files and the repository page answers 200, so
//                          every advertised URL resolves
//   repository page only   only the repository page answers, which is what
//                          the GitHub Pages URLs return until Pages is enabled
//
// Exits 0 when every check holds and 1 otherwise.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectAdvertisedUrls,
  extractAdvertisedUrls,
  retargetUrl,
  verifyAdvertisedUrls,
} from "./verify-advertised-urls.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "verify-advertised-urls.mjs");
const root = path.resolve(here, "..");
const pagesOrigin = "https://kyanitelabs.github.io";
const repositoryUrl = "https://github.com/KyaniteLabs/unstuck-coach-protocol";
const pagesUrlsWhilePagesAreOff = [
  "https://kyanitelabs.github.io/unstuck-coach-protocol/landing/",
  "https://kyanitelabs.github.io/unstuck-coach-protocol/landing/evidence.html",
  "https://kyanitelabs.github.io/unstuck-coach-protocol/landing/reel.html",
  "https://kyanitelabs.github.io/unstuck-coach-protocol/landing/assets/unstuck-coach-logo.png",
  "https://kyanitelabs.github.io/unstuck-coach-protocol/sitemap.xml",
];
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

const checks = [];
// A check that does not finish is reported as a failure instead of hanging
// the whole run (for example if the verifier ever loses its own timeout).
const checkTimeoutMs = 30000;

async function check(name, run) {
  let timer;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`did not finish within ${checkTimeoutMs} ms`)),
          checkTimeoutMs,
        );
      }),
    ]);
    checks.push({ name, status: "pass" });
  } catch (error) {
    checks.push({ name, status: "fail", detail: error.message });
  } finally {
    clearTimeout(timer);
  }
}

// A fixed target on 127.0.0.1. `respond` maps a request path to
// { status, type, body, headers }, possibly through a promise; a missing
// answer is a 404.
function startTarget(respond) {
  const requests = [];
  const server = http.createServer((request, response) => {
    const requestPath = new URL(request.url, "http://127.0.0.1").pathname;
    requests.push({
      method: request.method,
      path: request.url,
      headers: request.headers,
    });
    request.resume();
    Promise.resolve()
      .then(() => respond(requestPath))
      .catch(() => ({ status: 500 }))
      .then((outcome) => {
        response.writeHead(outcome?.status ?? 404, {
          "content-type": outcome?.type ?? "text/plain",
          ...(outcome?.headers ?? {}),
        });
        response.end(outcome?.body ?? "");
      });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        requests,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

const repositoryPath = new URL(repositoryUrl).pathname;
// GitHub Pages serves a project site's repository root under /<repository>/.
const pagesMount = new URL(`${pagesOrigin}/unstuck-coach-protocol/`).pathname;
const repositoryPage = {
  status: 200,
  type: "text/html",
  body: "<!doctype html><title>repository</title>",
};
const notFound = {
  status: 404,
  type: "text/html",
  body: "<!doctype html><title>404</title>",
};

// Serves this repository's own files under /unstuck-coach-protocol/, the way
// GitHub Pages serves a project site built from the repository root, plus a
// stub repository page. A 200 here therefore also proves that every advertised
// Pages path maps to a file that exists in this repository.
function servesThisFolder(requestPath) {
  if (requestPath === repositoryPath) return repositoryPage;
  if (!requestPath.startsWith(pagesMount)) return notFound;
  return servesFile(requestPath.slice(pagesMount.length - 1));
}

function servesFile(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return { status: 400 };
  }
  const relative = path.relative(
    root,
    path.resolve(root, `.${path.posix.normalize(decoded)}`),
  );
  if (relative.startsWith("..") || path.isAbsolute(relative)) return notFound;
  const file = decoded.endsWith("/")
    ? path.join(root, relative, "index.html")
    : path.join(root, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound;
  return {
    status: 200,
    type: contentTypes[path.extname(file)] ?? "application/octet-stream",
    body: fs.readFileSync(file),
  };
}

function servesOnlyTheRepositoryPage(requestPath) {
  return requestPath === repositoryPath ? repositoryPage : notFound;
}

// The verifier reads its sources from the working directory it is started in.
// The child is awaited, not spawned synchronously, so this process keeps
// answering the loopback fixture while the child requests from it.
function runCli(args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => child.kill(), 60000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function runVerifier(args, cwd = root) {
  const run = await runCli(args, cwd);
  assert.equal(run.signal, null, `the verifier was killed: ${run.stdout}${run.stderr}`);
  return run;
}

// A scratch directory that is removed again; it never leaves the temp dir.
function scratchDirectory(name, files) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), `verify-advertised-urls-${name}-`),
  );
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return {
    path: directory,
    remove() {
      assert.ok(
        directory.startsWith(path.join(os.tmpdir(), "verify-advertised-urls-")),
        "refusing to remove a directory this test did not create",
      );
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

const collected = collectAdvertisedUrls(root);
const advertisedUrls = collected.urls.map((entry) => entry.url);
const pagesUrls = advertisedUrls.filter((url) => url.startsWith(pagesOrigin));
const otherUrls = advertisedUrls.filter((url) => !url.startsWith(pagesOrigin));

await check("the repository advertises the five Pages URLs and its repository link, with no source problem", () => {
  assert.deepEqual(collected.failures, []);
  for (const url of pagesUrlsWhilePagesAreOff) {
    assert.ok(advertisedUrls.includes(url), `not advertised: ${url}`);
  }
  assert.ok(advertisedUrls.includes(repositoryUrl), "the repository link is not advertised");
  // The rendered README on the evidence page shows placeholder URLs in code
  // samples; those are documentation, not advertisements.
  assert.deepEqual(
    advertisedUrls.filter((url) => /OWNER|REPO/.test(url)),
    [],
  );
  // JSON-LD @context names a vocabulary; it is not an advertisement.
  assert.deepEqual(
    advertisedUrls.filter((url) => url.startsWith("https://schema.org")),
    [],
  );
  const landing = collected.urls.find((entry) => entry.url === pagesUrlsWhilePagesAreOff[0]);
  const landingSources = landing.sources.map((source) => `${source.file} ${source.tag}`.trim());
  for (const expected of [
    "llms.txt",
    "sitemap.xml",
    "landing/index.html canonical",
    "landing/index.html og:url",
    "landing/index.html json-ld url",
  ]) {
    assert.ok(landingSources.includes(expected), `the landing URL is not advertised by ${expected}`);
  }
});

await check("extraction: canonical, Open Graph, Twitter card, JSON-LD, sitemap, robots, and text sources", () => {
  const html = [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <!-- <link rel="canonical" href="https://pages.example.org/one/commented-out"> -->',
    '  <link href="https://pages.example.org/one/page/" rel="canonical">',
    '  <meta content="https://pages.example.org/one/logo.png" property="og:image">',
    '  <meta property="og:image:width" content="1200">',
    '  <meta property="og:type" content="website">',
    '  <link rel="icon" href="./assets/favicon.png">',
    '  <script type="application/ld+json">',
    '  {"@context":"https://schema.org","@type":"WebSite","url":"https://pages.example.org/one/page/","publisher":{"@type":"Organization","logo":{"@type":"ImageObject","url":"https://pages.example.org/one/logo.png"}},"sameAs":["https://social.example.org/one"]}',
    "  </script>",
    '  <script src="app.js"></script>',
    '  <link rel="canonical" href="https://pages.example.org/one/two/">',
    "</head>",
    "<body><pre>https://github.com/OWNER/REPO</pre><a href=\"/local/\">local</a></body>",
    "</html>",
  ].join("\n");
  const twitterCard = extractAdvertisedUrls([
    { file: "llms.txt", content: "Repository: https://github.com/example/one\n" },
    { file: "sitemap.xml", content: "<urlset></urlset>" },
    { file: "robots.txt", content: "User-agent: *\n" },
    {
      file: "landing/card.html",
      content: '<meta name="twitter:image" content="https://pages.example.org/one/card.png">\n<meta name="twitter:card" content="summary_large_image">',
    },
  ]);
  assert.deepEqual(twitterCard.urls.map((entry) => entry.url), [
    "https://github.com/example/one",
    "https://pages.example.org/one/card.png",
  ]);
  assert.deepEqual(twitterCard.failures, []);

  const { urls, failures } = extractAdvertisedUrls([
    {
      file: "llms.txt",
      content: [
        "# Unstuck Coach",
        "",
        "> [landing](https://pages.example.org/one/page/) and https://pages.example.org/one/page/ (see https://pages.example.org/one/evidence.html.)",
        "Repository: https://github.com/example/one",
      ].join("\n"),
    },
    {
      file: "sitemap.xml",
      content:
        "<urlset><url><loc>https://pages.example.org/one/page/?a=1&amp;b=2</loc></url><url><loc>/one/page/</loc></url></urlset>",
    },
    {
      file: "robots.txt",
      content: "User-agent: *\nAllow: /\nSITEMAP: https://pages.example.org/one/sitemap.xml\n",
    },
    { file: "landing/page.html", content: html },
  ]);
  assert.deepEqual(
    urls.map((entry) => entry.url),
    [
      "https://github.com/example/one",
      "https://pages.example.org/one/evidence.html",
      "https://pages.example.org/one/logo.png",
      "https://pages.example.org/one/page/",
      "https://pages.example.org/one/page/?a=1&b=2",
      "https://pages.example.org/one/sitemap.xml",
      "https://pages.example.org/one/two/",
      "https://social.example.org/one",
    ],
  );
  assert.deepEqual(failures, [
    "sitemap.xml:1 advertises \"/one/page/\", which is not an absolute http(s) URL.",
  ]);
  const byUrl = new Map(urls.map((entry) => [entry.url, entry.sources]));
  assert.deepEqual(byUrl.get("https://pages.example.org/one/page/"), [
    { file: "llms.txt", line: 3, tag: "" },
    { file: "landing/page.html", line: 5, tag: "canonical" },
    { file: "landing/page.html", line: 10, tag: "json-ld url" },
  ]);
  assert.deepEqual(byUrl.get("https://pages.example.org/one/logo.png"), [
    { file: "landing/page.html", line: 6, tag: "og:image" },
    { file: "landing/page.html", line: 10, tag: "json-ld url" },
  ]);
  assert.deepEqual(byUrl.get("https://pages.example.org/one/two/"), [
    { file: "landing/page.html", line: 14, tag: "canonical" },
  ]);
});

await check("extraction: a relative, protocol-relative, broken, or unreadable advertisement is a failure, never a silent skip", () => {
  const relativeCanonical = extractAdvertisedUrls([
    { file: "llms.txt", content: "no URL here" },
    { file: "sitemap.xml", content: "<urlset></urlset>" },
    { file: "robots.txt", content: "User-agent: *" },
    {
      file: "landing/index.html",
      content:
        '<link rel="canonical" href="/landing/">\n<meta name="twitter:image" content="//cdn.example.org/logo.png">\n<meta property="og:image" content="assets/logo.png">',
    },
  ]);
  assert.deepEqual(relativeCanonical.urls, []);
  assert.deepEqual(relativeCanonical.failures, [
    "landing/index.html:1 advertises \"/landing/\" as canonical, which is not an absolute http(s) URL.",
    "landing/index.html:2 advertises \"//cdn.example.org/logo.png\" as twitter:image, which is not an absolute http(s) URL.",
    "landing/index.html:3 advertises \"assets/logo.png\" as og:image, which is not an absolute http(s) URL.",
  ]);
  const brokenJsonLd = extractAdvertisedUrls([
    {
      file: "landing/index.html",
      content:
        '<script type="application/ld+json">\n{"url": "https://pages.example.org/one/",\n</script>',
    },
  ]);
  assert.equal(brokenJsonLd.urls.length, 0);
  assert.equal(brokenJsonLd.failures.length, 1);
  assert.match(
    brokenJsonLd.failures[0],
    /^landing\/index\.html:1 has a JSON-LD block that is not valid JSON \(/,
  );
  const unreadable = extractAdvertisedUrls([
    { file: "llms.txt", content: null },
    { file: "sitemap.xml", content: "<urlset></urlset>" },
    { file: "robots.txt", content: null },
  ]);
  assert.deepEqual(unreadable.failures, [
    "llms.txt could not be read, so the URLs it advertises cannot be checked.",
    "robots.txt could not be read, so the URLs it advertises cannot be checked.",
    "landing/ has no HTML page, so the URLs it advertises cannot be read.",
  ]);
});

await check("retargeting keeps the path, query, and fragment and only swaps the origin", () => {
  const url = "https://pages.example.org/one/page/?a=1#proof";
  assert.equal(retargetUrl(url), url);
  assert.equal(
    retargetUrl(url, "http://127.0.0.1:4173"),
    "http://127.0.0.1:4173/one/page/?a=1#proof",
  );
  assert.equal(
    retargetUrl("https://github.com/example/one", "http://127.0.0.1:4173"),
    "http://127.0.0.1:4173/example/one",
  );
});

let servingThisFolder;
let repositoryOnly;

await check(`fixed target serving this folder: all ${advertisedUrls.length} advertised URLs resolve (base-url mode)`, async () => {
  servingThisFolder = await startTarget(servesThisFolder);
  const summary = await verifyAdvertisedUrls({ root, baseUrl: servingThisFolder.origin });
  assert.equal(summary.status, "pass", summary.failures.join("\n"));
  assert.equal(summary.mode, "base-url");
  assert.equal(summary.total, advertisedUrls.length);
  assert.equal(summary.resolved, advertisedUrls.length);
  assert.equal(summary.unresolved, 0);
  assert.deepEqual(summary.failures, []);
  for (const result of summary.results) {
    assert.equal(result.status, 200, `${result.url} answered ${result.status}`);
    assert.equal(result.target, servingThisFolder.origin + new URL(result.url).pathname);
    assert.equal(result.finalUrl, result.target);
    // The 200 came from a real file of this repository, not from a stub.
    const expectedType = result.url.endsWith(".png")
      ? "image/png"
      : result.url.endsWith(".xml")
        ? "application/xml"
        : "text/html";
    assert.equal(result.contentType, expectedType, result.url);
  }
});

await check("every request the verifier sends is an anonymous GET", () => {
  assert.ok(servingThisFolder.requests.length >= advertisedUrls.length);
  for (const request of servingThisFolder.requests) {
    assert.equal(request.method, "GET", `${request.path} was requested with ${request.method}`);
    for (const header of ["authorization", "cookie", "proxy-authorization"]) {
      assert.equal(request.headers[header], undefined, `${request.path} was sent with a ${header} header`);
    }
  }
});

await check("the verifier exits 0 and prints a passing summary in base-url mode", async () => {
  const run = await runVerifier(["--base-url", servingThisFolder.origin, "--json"]);
  assert.equal(run.code, 0, run.stderr + run.stdout);
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.status, "pass");
  assert.equal(summary.resolved, advertisedUrls.length);
  const report = await runVerifier(["--base-url", servingThisFolder.origin]);
  assert.equal(report.code, 0, report.stderr + report.stdout);
  assert.ok(
    report.stdout.startsWith(`PASS: all ${advertisedUrls.length} advertised URLs resolve.`),
    report.stdout,
  );
});

await check("redirects are followed and the final URL is reported", async () => {
  const redirected = await startTarget((requestPath) => {
    if (requestPath.startsWith("/mirrored/")) {
      return servesThisFolder(requestPath.slice("/mirrored".length));
    }
    return requestPath === repositoryPath
      ? repositoryPage
      : { status: 302, headers: { location: `/mirrored${requestPath}` } };
  });
  try {
    const summary = await verifyAdvertisedUrls({ root, baseUrl: redirected.origin });
    assert.equal(summary.status, "pass", summary.failures.join("\n"));
    const landing = summary.results.find(
      (result) => result.url === pagesUrlsWhilePagesAreOff[0],
    );
    assert.equal(landing.status, 200);
    assert.equal(
      landing.finalUrl,
      `${redirected.origin}/mirrored${new URL(landing.url).pathname}`,
    );
  } finally {
    await redirected.close();
  }
});

await check(
  `fixed target serving only the repository page: all ${pagesUrls.length} GitHub Pages URLs fail and the repository link resolves`,
  async () => {
    repositoryOnly = await startTarget(servesOnlyTheRepositoryPage);
    const summary = await verifyAdvertisedUrls({ root, baseUrl: repositoryOnly.origin });
    assert.equal(summary.status, "fail");
    assert.equal(summary.total, advertisedUrls.length);
    assert.equal(summary.unresolved, pagesUrls.length);
    assert.deepEqual(
      summary.results.filter((result) => !result.resolved).map((result) => result.url),
      [...pagesUrls],
    );
    assert.deepEqual(
      summary.results.filter((result) => result.resolved).map((result) => result.url),
      [...otherUrls],
    );
    assert.deepEqual(otherUrls, [repositoryUrl]);
    assert.deepEqual(summary.sourceProblems, []);
    assert.equal(summary.failures.length, pagesUrls.length);
    for (const result of summary.results) {
      assert.equal(result.status, result.resolved ? 200 : 404, `${result.url} answered ${result.status}`);
      if (!result.resolved) {
        assert.match(
          summary.failures.find((failure) => failure.startsWith(`${result.url} does not resolve (HTTP 404); `)),
          /; advertised by .+\.$/,
        );
      }
    }
  },
);

await check("the verifier exits 1, names each dead URL, and reports the repository link as resolving", async () => {
  const run = await runVerifier(["--base-url", repositoryOnly.origin]);
  assert.equal(run.code, 1, run.stdout + run.stderr);
  assert.equal(run.stderr, "");
  assert.ok(
    run.stdout.startsWith(`FAIL: ${pagesUrls.length} of ${advertisedUrls.length} advertised URLs do not resolve.`),
    run.stdout,
  );
  for (const url of pagesUrlsWhilePagesAreOff) {
    assert.match(
      run.stdout,
      new RegExp(`^FAIL  ${url.replace(/[.]/g, "\\.")}  HTTP 404$`, "m"),
      run.stdout,
    );
  }
  assert.match(
    run.stdout,
    /^OK    https:\/\/github\.com\/KyaniteLabs\/unstuck-coach-protocol  HTTP 200$/m,
  );
  const json = await runVerifier(["--base-url", repositoryOnly.origin, "--json"]);
  assert.equal(json.code, 1);
  assert.equal(JSON.parse(json.stdout).unresolved, pagesUrls.length);
});

await check("a target that refuses connections fails every URL with the network error", async () => {
  const refused = await startTarget(servesThisFolder);
  const { origin } = refused;
  await refused.close();
  const summary = await verifyAdvertisedUrls({ root, baseUrl: origin, timeoutMs: 5000 });
  assert.equal(summary.status, "fail");
  assert.equal(summary.unresolved, advertisedUrls.length);
  for (const result of summary.results) {
    assert.equal(result.status, null);
    assert.match(result.error, /ECONNREFUSED/);
  }
});

await check("a target that never answers fails every URL once the timeout passes", async () => {
  const silent = await startTarget(() => new Promise(() => {}));
  try {
    const started = Date.now();
    const summary = await verifyAdvertisedUrls({ root, baseUrl: silent.origin, timeoutMs: 300 });
    assert.ok(Date.now() - started >= 300, "the timeout was not waited for");
    assert.equal(summary.status, "fail");
    assert.equal(summary.unresolved, advertisedUrls.length);
    for (const result of summary.results) {
      assert.equal(result.error, "no response within 300 ms", result.url);
    }
  } finally {
    await silent.close();
  }
});

await check("a source that advertises a non-absolute URL, or nothing at all, fails without any request", async () => {
  const scratch = scratchDirectory("sources", {
    "llms.txt": "No link in this file.\n",
    "sitemap.xml": "<urlset></urlset>\n",
    "robots.txt": "User-agent: *\n",
    "landing/index.html": '<link rel="canonical" href="/landing/">\n',
  });
  const nothingAnswers = await startTarget(() => notFound);
  try {
    const empty = await verifyAdvertisedUrls({
      root: scratch.path,
      baseUrl: nothingAnswers.origin,
    });
    assert.equal(empty.status, "fail");
    assert.equal(empty.total, 0);
    assert.deepEqual(empty.sourceProblems, [
      "landing/index.html:1 advertises \"/landing/\" as canonical, which is not an absolute http(s) URL.",
      "No advertised URL was found in llms.txt, sitemap.xml, robots.txt, or landing/*.html.",
    ]);
    fs.rmSync(path.join(scratch.path, "landing/index.html"));
    const noPages = await verifyAdvertisedUrls({ root: scratch.path });
    assert.equal(noPages.status, "fail");
    assert.equal(noPages.total, 0);
    assert.deepEqual(noPages.sourceProblems, [
      "landing/ has no HTML page, so the URLs it advertises cannot be read.",
      "No advertised URL was found in llms.txt, sitemap.xml, robots.txt, or landing/*.html.",
    ]);
    assert.deepEqual(nothingAnswers.requests, []);
  } finally {
    await nothingAnswers.close();
    scratch.remove();
  }
});

await check("a source problem is reported next to the URL results", async () => {
  const scratch = scratchDirectory("problem", {
    "llms.txt": "Repository: https://github.com/example/one\n",
    "sitemap.xml": "<urlset><loc>/one/</loc></urlset>\n",
    "robots.txt": "Sitemap: https://pages.example.org/one/sitemap.xml\n",
    "landing/index.html": '<link rel="canonical" href="https://pages.example.org/one/">\n',
  });
  const everythingAnswers = await startTarget(() => ({ status: 200 }));
  try {
    const summary = await verifyAdvertisedUrls({
      root: scratch.path,
      baseUrl: everythingAnswers.origin,
    });
    assert.equal(summary.status, "fail");
    assert.equal(summary.unresolved, 0, summary.failures.join("\n"));
    assert.deepEqual(summary.sourceProblems, [
      "sitemap.xml:1 advertises \"/one/\", which is not an absolute http(s) URL.",
    ]);
    const run = await runVerifier(["--base-url", everythingAnswers.origin], scratch.path);
    assert.equal(run.code, 1, run.stdout + run.stderr);
    assert.match(
      run.stdout,
      /^FAIL: 0 of 3 advertised URLs do not resolve; 1 source problem\.$/m,
    );
    assert.match(
      run.stdout,
      /^PROBLEM  sitemap\.xml:1 advertises "\/one\/", which is not an absolute http\(s\) URL\.$/m,
    );
  } finally {
    await everythingAnswers.close();
    scratch.remove();
  }
});

await check("unknown or malformed arguments exit 2 and print the usage", async () => {
  for (const args of [
    ["--wat"],
    ["--base-url"],
    ["--base-url", "nope"],
    ["--base-url", "https://pages.example.org/one/"],
    ["--base-url", "ftp://127.0.0.1/"],
  ]) {
    const run = await runVerifier(args);
    assert.equal(run.code, 2, `${args.join(" ")} exited ${run.code}`);
    assert.match(
      run.stderr,
      /^(?:.+\n\n)?usage: node scripts\/verify-advertised-urls\.mjs \[--base-url ORIGIN\] \[--json\]/,
    );
    assert.equal(run.stdout, "");
  }
  const help = await runVerifier(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /--base-url ORIGIN/);
});

await Promise.all(
  [servingThisFolder, repositoryOnly].map((target) => target?.close()),
);

const failed = checks.filter((entry) => entry.status === "fail");
// A failed check can leave a fixture socket or a pending request behind, so
// the process is ended explicitly once the summary is written.
process.stdout.write(
  `${JSON.stringify(
    {
      status: failed.length === 0 ? "pass" : "fail",
      target: "loopback fixtures only; nothing was requested from the network",
      advertisedUrls: advertisedUrls.length,
      pagesUrls: pagesUrls.length,
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      checks,
    },
    null,
    2,
  )}\n`,
  () => process.exit(failed.length === 0 ? 0 : 1),
);
