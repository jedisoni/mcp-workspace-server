import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { makeSandbox } from "./sandbox.js";
import { registerTools } from "./tools.js";

const PORT = Number(process.env.PORT ?? 3000);
const TOKEN = process.env.MCP_AUTH_TOKEN;
if (!TOKEN || TOKEN.length < 16) {
  console.error("MCP_AUTH_TOKEN must be set (16+ chars). See .env.example");
  process.exit(1);
}
const ROOT = path.resolve(process.env.WORKSPACE_ROOT ?? "./workspace");
const LOG_FILE = path.resolve(process.env.LOG_FILE ?? "./logs/tool_calls.jsonl");
const TEMPLATE = path.resolve("./workspace-template");

// First boot: seed workspace with handoff templates and init git.
if (!fs.existsSync(ROOT)) {
  fs.mkdirSync(ROOT, { recursive: true });
  if (fs.existsSync(TEMPLATE)) fs.cpSync(TEMPLATE, ROOT, { recursive: true });
}
if (!fs.existsSync(path.join(ROOT, ".git"))) execFileSync("git", ["init"], { cwd: ROOT });

const sandbox = makeSandbox(ROOT);

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Auth: "Authorization: Bearer <token>" header, OR secret path /mcp/<token>
// (fallback for clients that cannot set headers).
function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const pathToken = req.params.token ?? "";
  if (safeEqual(header, `Bearer ${TOKEN}`) || (pathToken && safeEqual(pathToken, TOKEN!))) return next();
  res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Stateless Streamable HTTP: fresh server+transport per request => survives restarts.
app.post(["/mcp", "/mcp/:token"], auth, async (req, res) => {
  const server = new McpServer({ name: "workspace-files", version: "1.0.0" });
  registerTools(server, sandbox, LOG_FILE);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP request failed:", e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});

const notAllowed = (_req: Request, res: Response) =>
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null });
app.get(["/mcp", "/mcp/:token"], notAllowed);
app.delete(["/mcp", "/mcp/:token"], notAllowed);

app.listen(PORT, () => console.log(`MCP server on :${PORT} | workspace: ${sandbox.root}`));
