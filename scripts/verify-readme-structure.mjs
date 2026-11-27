#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { publicBundleFiles } from "./public-bundle-files.mjs";

const readmeFile = "README.md";
const evidenceFile = "landing/evidence.html";
const evidenceBuilder = "scripts/build-evidence-page.mjs";
const emptyBodyText = "No additional body text in this section.";

// The headings that tell a reader how to run the coach, and the one heading
// that must own them.
const runInstructionParent = "How To Use";
const runInstructionHeadings = [
  "Claude Project",
  "Codex",
  "Antigravity Or Another AI IDE",
  "Local Models",
];

// escapeHtml, renderInline and splitReaderSections mirror build-evidence-page.mjs
// so this check reads the README exactly the way the evidence reader does. If the
// builder changes its heading split or inline rendering, change the mirrors too.
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(value) {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    return `<span class="rendered-link"><span>${label}</span><code>${escapeHtml(href)}</code></span>`;
  });
  return output;
}

function splitReaderSections(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      if (current) {
        sections.push(current);
      }
      current = {
        title: heading[2].trim(),
        lines: [],
      };
      continue;
    }

    if (!current) {
      current = {
        title: "Opening notes",
        lines: [],
      };
    }

    current.lines.push(line);
  }

  if (current) {
    sections.push(current);
  }

  return sections
    .filter((section) => section.title || section.lines.some((line) => line.trim()))
    .map((section) => ({
      title: section.title,
      lineCount: section.lines.filter((line) => line.trim()).length,
    }));
}

// ATX headings outside fenced code blocks (a "#" line inside a fence is code,
// not a heading), each with the number of non-blank lines before the next
// heading of any level and the heading that owns it. Fenced lines count as
// body, because that is what the evidence reader counts and renders.
function parseHeadingTree(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const headings = [];
  let fence = null;

  const countBodyLine = (line) => {
    if (headings.length > 0 && line.trim()) {
      headings[headings.length - 1].bodyLines += 1;
    }
  };

  lines.forEach((line, index) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) {
        fence = marker[1];
      } else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) {
        fence = null;
      }
      countBodyLine(line);
      return;
    }
    if (fence) {
      countBodyLine(line);
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      headings.push({
        level: heading[1].length,
        title: heading[2].trim(),
        line: index + 1,
        bodyLines: 0,
        parent: null,
      });
      return;
    }

    countBodyLine(line);
  });

  headings.forEach((heading, index) => {
    for (let candidate = index - 1; candidate >= 0; candidate -= 1) {
      if (headings[candidate].level < heading.level) {
        heading.parent = headings[candidate];
        break;
      }
    }
  });

  return headings;
}

const sectionPattern =
  /<details class="rendered-section"[^>]*>\s*<summary><span>([\s\S]*?)<\/span><small>(\d+) lines<\/small><\/summary>\s*<div class="rendered-section-body">\s*([\s\S]*?)\s*<\/div>\s*<\/details>/g;

function renderedArticles(html) {
  const articles = [];
  const articlePattern = /<article id="([^"]+)" class="evidence-card rendered-source"[^>]*>([\s\S]*?)<\/article>/g;
  for (const match of html.matchAll(articlePattern)) {
    const sections = [...match[2].matchAll(sectionPattern)].map((section) => ({
      title: section[1],
      lineCount: Number(section[2]),
      body: section[3],
    }));
    articles.push({ id: match[1], sections });
  }
  return articles;
}

// Re-render the evidence page from a throwaway copy of the public bundle and
// return its bytes, so the committed page can be compared with what the builder
// produces now. Nothing in the working folder is written.
function freshEvidencePage(root) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "unstuck-readme-structure-"));

  try {
    for (const file of publicBundleFiles) {
      const source = path.join(root, file);
      if (!fs.existsSync(source)) {
        throw new Error(`cannot re-render ${evidenceFile}: public bundle file is missing: ${file}`);
      }
      const target = path.join(tempRoot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }

    const result = spawnSync(process.execPath, [evidenceBuilder], {
      cwd: tempRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "").trim();
      throw new Error(`${evidenceBuilder} exited with ${result.status ?? 1}: ${detail}`);
    }

    return fs.readFileSync(path.join(tempRoot, evidenceFile));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function quoteList(titles) {
  return `[${titles.map((title) => `"${title}"`).join(", ")}]`;
}

export function verifyReadmeStructure(root = process.cwd()) {
  const readmePath = path.join(root, readmeFile);
  const evidencePath = path.join(root, evidenceFile);

  if (!fs.existsSync(readmePath)) {
    return {
      checked: false,
      failures: [`Missing ${readmeFile}.`],
    };
  }

  const failures = [];
  const readme = fs.readFileSync(readmePath, "utf8");
  const headings = parseHeadingTree(readme);

  for (const heading of headings) {
    if (heading.bodyLines === 0) {
      failures.push(
        `${readmeFile} line ${heading.line}: heading "${heading.title}" has an empty section (no text before the next heading), ` +
          `so the evidence reader shows it as "0 lines".`,
      );
    }
  }

  const parentHeadings = headings.filter((heading) => heading.title === runInstructionParent);
  if (parentHeadings.length !== 1) {
    failures.push(
      `${readmeFile}: expected exactly one "${runInstructionParent}" heading, found ${parentHeadings.length}.`,
    );
  }
  const parent = parentHeadings[0] || null;
  if (parent && parent.level !== 2) {
    failures.push(
      `${readmeFile} line ${parent.line}: "${runInstructionParent}" is a level-${parent.level} heading, expected level 2.`,
    );
  }

  const children = parent
    ? headings.filter((heading) => heading.parent === parent).map((heading) => heading.title)
    : [];
  if (parent && JSON.stringify(children) !== JSON.stringify(runInstructionHeadings)) {
    failures.push(
      `${readmeFile}: the subsections of "${runInstructionParent}" are ${quoteList(children)}, expected ${quoteList(runInstructionHeadings)}.`,
    );
  }

  for (const title of runInstructionHeadings) {
    const matches = headings.filter((heading) => heading.title === title);
    if (matches.length !== 1) {
      failures.push(
        `${readmeFile}: run-instruction heading "${title}" appears ${matches.length} times, expected exactly once.`,
      );
      continue;
    }

    const heading = matches[0];
    if (heading.level !== 3) {
      failures.push(
        `${readmeFile} line ${heading.line}: run-instruction heading "${title}" is a level-${heading.level} heading, expected level 3.`,
      );
    }
    if (!parent || heading.parent !== parent) {
      failures.push(
        `${readmeFile} line ${heading.line}: run-instruction heading "${title}" sits under "${heading.parent?.title ?? "no heading"}", expected "${runInstructionParent}".`,
      );
    }
  }

  let evidencePageCurrent = false;
  let evidenceSections = [];
  let outOfScopeEmptySections = [];

  if (!fs.existsSync(evidencePath)) {
    failures.push(`Missing ${evidenceFile}.`);
  } else {
    const committed = fs.readFileSync(evidencePath);
    const articles = renderedArticles(committed.toString("utf8"));
    const readmeArticle = articles.find((article) => article.id === "readme");
    evidenceSections = readmeArticle ? readmeArticle.sections : [];

    if (!readmeArticle) {
      failures.push(`${evidenceFile} has no README article (data-reader-document="readme").`);
    } else if (evidenceSections.length === 0) {
      failures.push(`${evidenceFile}: the README article renders no sections.`);
    } else {
      for (const section of evidenceSections) {
        if (section.lineCount === 0) {
          failures.push(`${evidenceFile}: README section "${section.title}" renders "0 lines" (an empty section card).`);
        }
        if (section.body.includes(emptyBodyText)) {
          failures.push(`${evidenceFile}: README section "${section.title}" renders "${emptyBodyText}".`);
        }
      }

      const expected = splitReaderSections(readme).map((section) => ({
        title: renderInline(section.title),
        lineCount: section.lineCount,
      }));
      if (evidenceSections.length !== expected.length) {
        failures.push(
          `${evidenceFile}: the README article renders ${evidenceSections.length} sections, ${readmeFile} has ${expected.length}.`,
        );
      }
      expected.forEach((section, index) => {
        const rendered = evidenceSections[index];
        if (!rendered || rendered.title !== section.title || rendered.lineCount !== section.lineCount) {
          failures.push(
            `${evidenceFile} is stale: ${readmeFile} section ${index + 1} is "${section.title}" (${section.lineCount} lines), ` +
              `the page renders "${rendered?.title ?? "nothing"}" (${rendered?.lineCount ?? "no"} lines).`,
          );
        }
      });
    }

    outOfScopeEmptySections = articles
      .filter((article) => article.id !== "readme")
      .flatMap((article) =>
        article.sections
          .filter((section) => section.lineCount === 0)
          .map((section) => `${article.id}: ${section.title}`),
      );

    try {
      const fresh = freshEvidencePage(root);
      evidencePageCurrent = fresh.equals(committed);
      if (!evidencePageCurrent) {
        failures.push(
          `${evidenceFile} is not the current output of \`node ${evidenceBuilder}\`; run it and commit the result.`,
        );
      }
    } catch (error) {
      failures.push(error.message);
    }
  }

  return {
    status: failures.length === 0 ? "pass" : "fail",
    checked: true,
    readmeHeadings: headings.length,
    runInstructionParent,
    runInstructionChildren: children,
    evidenceReadmeSections: evidenceSections.length,
    evidencePageCurrent,
    // Informational only: empty section cards in documents other than the README.
    // Those files are coach protocol content, outside this check's scope.
    outOfScopeEmptySections,
    failures,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = verifyReadmeStructure();
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failures.length > 0) {
    process.exitCode = 1;
  }
}
