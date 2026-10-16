import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Sandbox } from "./sandbox.js";

const run = promisify(execFile);
const MAX_WRITE_BYTES = 1_000_000;
const version = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

const trunc = (v: unknown): unknown =>
  typeof v === "string" && v.length > 200 ? v.slice(0, 200) + `…(+${v.length - 200} chars)` : v;

export function registerTools(server: McpServer, sb: Sandbox, logFile: string) {
  const audit = (entry: object) => {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  };

  // Wrapper: zod validation is done by the SDK; this catches errors -> isError and audits every call.
  function def<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    fn: (a: z.infer<z.ZodObject<S>>) => Promise<string> | string
  ) {
    (server as any).tool(name, description, shape, async (args: any) => {
      const safeArgs = Object.fromEntries(Object.entries(args ?? {}).map(([k, v]) => [k, trunc(v)]));
      try {
        const text = await fn(args);
        audit({ tool: name, args: safeArgs, ok: true });
        return { content: [{ type: "text" as const, text }] };
      } catch (e: any) {
        audit({ tool: name, args: safeArgs, ok: false, error: e.message });
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
      }
    });
  }

  const git = async (...args: string[]) => {
    const { stdout, stderr } = await run("git", args, { cwd: sb.root, timeout: 15_000 });
    return (stdout + stderr).trim() || "(no output)";
  };

  def("list_files",
    "List files and folders in a workspace directory (non-recursive, max 200 entries). Use '.' for the workspace root.",
    { path: z.string().default(".").describe("Directory relative to workspace root") },
    ({ path: p }) => {
      const dir = sb.resolveSafe(p);
      if (!fs.statSync(dir).isDirectory()) throw new Error(`'${p}' is not a directory. Use read_file for files.`);
      const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== ".git").slice(0, 200);
      if (!entries.length) return "(empty directory)";
      return entries
        .map((e) => (e.isDirectory() ? `d ${e.name}/` : `f ${e.name} (${fs.statSync(path.join(dir, e.name)).size} B)`))
        .join("\n");
    });

  def("read_file",
    "Read a text file in line-based chunks. Returns a version hash you can pass to write_file as if_version. Prefer small limits; page with offset.",
    {
      path: z.string(),
      offset: z.number().int().min(0).default(0).describe("0-based first line"),
      limit: z.number().int().min(1).max(1000).default(200).describe("Max lines to return"),
    },
    ({ path: p, offset, limit }) => {
      const file = sb.resolveSafe(p);
      if (!fs.existsSync(file)) throw new Error(`File not found: ${p}. Try list_files or search_files.`);
      if (fs.statSync(file).isDirectory()) throw new Error(`'${p}' is a directory. Use list_files.`);
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      const slice = lines.slice(offset, offset + limit);
      const end = offset + slice.length;
      const more = end < lines.length ? ` | more: call again with offset=${end}` : "";
      return `# ${p} | lines ${offset}-${end} of ${lines.length} | version ${version(content)}${more}\n${slice.join("\n")}`;
    });

  def("write_file",
    "Create or overwrite a text file (max 1 MB). Parent folders are created. If if_version is given and the file changed since you read it, the write is refused.",
    {
      path: z.string(),
      content: z.string(),
      if_version: z.string().optional().describe("Version hash from read_file, for optimistic locking"),
    },
    ({ path: p, content, if_version }) => {
      if (Buffer.byteLength(content) > MAX_WRITE_BYTES) throw new Error("Content exceeds 1 MB limit.");
      const file = sb.resolveSafe(p);
      if (if_version && fs.existsSync(file)) {
        const current = version(fs.readFileSync(file, "utf8"));
        if (current !== if_version) throw new Error(`Version conflict: file is now ${current}, you had ${if_version}. Re-read it first.`);
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      return `Wrote ${p} (${Buffer.byteLength(content)} B) | version ${version(content)}`;
    });

  def("str_replace",
    "Replace exactly one occurrence of old_str with new_str in a file. Fails if old_str is missing or appears more than once (add more context).",
    { path: z.string(), old_str: z.string().min(1), new_str: z.string() },
    ({ path: p, old_str, new_str }) => {
      const file = sb.resolveSafe(p);
      if (!fs.existsSync(file)) throw new Error(`File not found: ${p}.`);
      const content = fs.readFileSync(file, "utf8");
      const count = content.split(old_str).length - 1;
      if (count === 0) throw new Error("old_str not found. Re-read the file and copy the text exactly.");
      if (count > 1) throw new Error(`old_str appears ${count} times; include more surrounding text so it is unique.`);
      const updated = content.replace(old_str, () => new_str);
      fs.writeFileSync(file, updated);
      return `Replaced 1 occurrence in ${p} | version ${version(updated)}`;
    });

  def("delete_file",
    "DESTRUCTIVE: permanently delete one file (not folders). Requires confirm=true. Every call is audit-logged.",
    { path: z.string(), confirm: z.literal(true).describe("Must be true to proceed") },
    ({ path: p }) => {
      const file = sb.resolveSafe(p);
      if (file === sb.root) throw new Error("Refusing to delete the workspace root.");
      if (!fs.existsSync(file)) throw new Error(`File not found: ${p}.`);
      if (fs.statSync(file).isDirectory()) throw new Error("delete_file only removes files, not directories.");
      fs.unlinkSync(file);
      return `Deleted ${p}`;
    });

  def("search_files",
    "Case-insensitive substring search across workspace text files. Returns path:line:text, capped at max_results. Use this instead of reading whole files.",
    {
      query: z.string().min(1),
      path: z.string().default(".").describe("Directory to search under"),
      max_results: z.number().int().min(1).max(100).default(20),
    },
    ({ query, path: p, max_results }) => {
      const start = sb.resolveSafe(p);
      const q = query.toLowerCase();
      const hits: string[] = [];
      const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (hits.length >= max_results) return;
          if (e.name === ".git" || e.name === "node_modules" || e.isSymbolicLink()) continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) { walk(full); continue; }
          if (fs.statSync(full).size > MAX_WRITE_BYTES) continue;
          const lines = fs.readFileSync(full, "utf8").split("\n");
          for (let i = 0; i < lines.length && hits.length < max_results; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              hits.push(`${path.relative(sb.root, full)}:${i + 1}:${lines[i].trim().slice(0, 160)}`);
            }
          }
        }
      };
      walk(start);
      return hits.length ? hits.join("\n") : "No matches.";
    });

  def("git_status", "Show uncommitted changes in the workspace (short format).", {},
    () => git("status", "--short").then((s) => (s === "(no output)" ? "Clean: nothing to commit." : s)));

  def("git_commit",
    "Stage ALL changes in the workspace and commit them with the given message. Use at checkpoints.",
    { message: z.string().min(3).max(200) },
    async ({ message }) => {
      await git("add", "-A");
      return git("-c", "user.name=mcp-agent", "-c", "user.email=agent@localhost", "commit", "-m", message);
    });

  def("git_log", "Show recent commits (one line each).",
    { limit: z.number().int().min(1).max(50).default(10) },
    ({ limit }) => git("log", "--oneline", "-n", String(limit)).catch(() => "No commits yet."));
}
