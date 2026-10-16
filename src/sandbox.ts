import fs from "node:fs";
import path from "node:path";

export class SandboxError extends Error {}

export interface Sandbox {
  root: string;
  resolveSafe(p: string): string;
}

/** All paths are resolved against `rootDir`; anything that escapes is rejected. */
export function makeSandbox(rootDir: string): Sandbox {
  fs.mkdirSync(rootDir, { recursive: true });
  const root = fs.realpathSync(rootDir);
  const inside = (p: string) => p === root || p.startsWith(root + path.sep);

  function resolveSafe(p: string): string {
    if (typeof p !== "string" || p.length === 0) throw new SandboxError("Path must be a non-empty string.");
    if (p.includes("\0")) throw new SandboxError("Path contains a null byte.");
    if (path.isAbsolute(p)) throw new SandboxError("Absolute paths are not allowed; use a path relative to the workspace.");

    const full = path.resolve(root, p);
    if (!inside(full)) throw new SandboxError("Path escapes the workspace.");

    const rel = path.relative(root, full);
    if (rel.split(path.sep).includes(".git")) throw new SandboxError("Access to .git is not allowed.");

    // Symlink check: the nearest existing ancestor must really live inside root.
    let probe = full;
    while (!fs.existsSync(probe) && probe !== root) probe = path.dirname(probe);
    if (fs.existsSync(probe) && !inside(fs.realpathSync(probe))) {
      throw new SandboxError("Path resolves (via symlink) outside the workspace.");
    }
    return full;
  }

  return { root, resolveSafe };
}
