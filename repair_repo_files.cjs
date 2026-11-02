#!/usr/bin/env node
/**
 * repair_repo_files.cjs - fix file-encoding damage in the Sell Up repo.
 *
 * What went wrong: some files were written on Windows with a byte-order mark (BOM) or as
 * UTF-16, and schema.ts got a UTF-16 block appended in the middle of a UTF-8 file. The
 * build tools cannot parse that.
 *
 * What this does (run it from the repo root, on your computer):
 *   1. Rebuilds src/db/schema.ts as clean UTF-8 (LF line endings, no BOM) from two git
 *      commits: the last good full file, plus the extra tables from the later commit.
 *   2. Scans src/, drizzle/ and scripts/ and converts any UTF-16 file to UTF-8 and strips
 *      any UTF-8 BOM.
 *   3. Prints what it changed. Nothing is committed; review with `git diff --stat`.
 *
 * Usage:
 *   node repair_repo_files.cjs --schema 90f7364 6229271
 *   node repair_repo_files.cjs --dry-run --schema 90f7364 6229271    (report only)
 *   node repair_repo_files.cjs                                       (encoding repair only)
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const si = args.indexOf("--schema");
const SCHEMA_BASE = si >= 0 ? args[si + 1] : null;
const SCHEMA_EXTRA = si >= 0 ? args[si + 2] : null;

if (!fs.existsSync("package.json") || !fs.existsSync(".git")) {
  console.error("Run this from the repo root (the folder containing package.json and .git).");
  process.exit(1);
}

const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".json", ".css", ".md"]);
const SKIP = new Set(["node_modules", ".next", ".git"]);

/** Decode a buffer to a JS string, handling UTF-16 (with or without BOM) and UTF-8 BOM. */
function decode(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return { text: buf.slice(2).toString("utf16le"), kind: "UTF-16LE" };
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.slice(2));
    swapped.swap16();
    return { text: swapped.toString("utf16le"), kind: "UTF-16BE" };
  }
  if (buf.length >= 4 && buf.length % 2 === 0 && buf[1] === 0 && buf[3] === 0 && buf[0] !== 0) {
    return { text: buf.toString("utf16le"), kind: "UTF-16LE (no BOM)" };
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { text: buf.slice(3).toString("utf8"), kind: "UTF-8 BOM" };
  return { text: buf.toString("utf8"), kind: "UTF-8" };
}

function gitShow(commit, file) {
  return execFileSync("git", ["show", `${commit}:${file}`], { maxBuffer: 256 * 1024 * 1024 });
}

const toLF = (s) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

// ---------- 1. rebuild schema.ts ----------
if (SCHEMA_BASE && SCHEMA_EXTRA) {
  const base = decode(gitShow(SCHEMA_BASE, "src/db/schema.ts"));
  const extra = decode(gitShow(SCHEMA_EXTRA, "src/db/schema.ts"));
  const text = toLF(base.text).replace(/\s+$/, "") + "\n\n" + toLF(extra.text).replace(/^\s+/, "").replace(/\s+$/, "") + "\n";
  const tables = (text.match(/pgTable\(/g) || []).length;
  const ok = !text.includes("\u0000") && /export const taxSettings\b/.test(text) && /export const exchangeRates\b/.test(text);
  console.log(`schema.ts: base ${SCHEMA_BASE} (${base.kind}) + extra ${SCHEMA_EXTRA} (${extra.kind}) -> ${text.split("\n").length} lines, ${tables} tables, sanity ${ok ? "OK" : "FAILED"}`);
  if (!ok) {
    console.error("The rebuilt schema.ts failed its sanity check; not writing it.");
    process.exit(1);
  }
  if (!DRY) fs.writeFileSync("src/db/schema.ts", text, "utf8");
}

// ---------- 2. scan for BOM / UTF-16 ----------
let fixed = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (EXT.has(path.extname(name).toLowerCase())) {
      const buf = fs.readFileSync(full);
      const { text, kind } = decode(buf);
      if (kind !== "UTF-8") {
        fixed++;
        console.log(`${DRY ? "would fix" : "fixed"}  ${full}   (${kind} -> UTF-8)`);
        if (!DRY) fs.writeFileSync(full, text, "utf8");
      }
    }
  }
}
for (const d of ["src", "drizzle", "scripts"]) if (fs.existsSync(d)) walk(d);
console.log(`\n${fixed} file(s) ${DRY ? "need fixing" : "fixed"}.${DRY ? "" : " Review with: git diff --stat"}`);
