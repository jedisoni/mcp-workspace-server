import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeSandbox } from "../src/sandbox.js";

const base = fs.mkdtempSync(path.join(os.tmpdir(), "sbx-"));
const root = path.join(base, "workspace");
const outside = path.join(base, "outside");
fs.mkdirSync(outside, { recursive: true });
fs.writeFileSync(path.join(outside, "secret.txt"), "top secret");
const sb = makeSandbox(root);

test("allows normal nested paths", () => {
  assert.ok(sb.resolveSafe("a/b/c.txt").startsWith(sb.root));
  assert.equal(sb.resolveSafe("."), sb.root);
});
test("rejects ../ traversal", () => {
  assert.throws(() => sb.resolveSafe("../outside/secret.txt"));
  assert.throws(() => sb.resolveSafe("a/../../outside/secret.txt"));
});
test("rejects absolute paths", () => {
  assert.throws(() => sb.resolveSafe("/etc/passwd"));
});
test("rejects null bytes and empty paths", () => {
  assert.throws(() => sb.resolveSafe("a\0b"));
  assert.throws(() => sb.resolveSafe(""));
});
test("rejects .git access", () => {
  assert.throws(() => sb.resolveSafe(".git/config"));
});
test("rejects symlink escape", () => {
  fs.symlinkSync(outside, path.join(root, "link"), "junction");
  assert.throws(() => sb.resolveSafe("link/secret.txt"));
});
