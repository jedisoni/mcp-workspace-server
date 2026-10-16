# MCP Workspace Server

A sandboxed MCP file-server with git-lite tools, served over Streamable HTTP.
Agents get shared memory through four handoff files in the workspace.

**Stack:** Node.js 20.6+ · official TypeScript MCP SDK · Streamable HTTP (stateless) · zod · ngrok · pm2 · git

## Tools (9)
`list_files`, `read_file` (chunked, returns version hash), `write_file` (optional `if_version` lock),
`str_replace` (unique match only), `delete_file` (needs `confirm: true`), `search_files`,
`git_status`, `git_commit`, `git_log`. Every call is audit-logged to `logs/tool_calls.jsonl`.

## Setup
```bash
git clone <your-repo-url> && cd mcp-workspace-server
npm install
cp .env.example .env        # set MCP_AUTH_TOKEN to a long random string
npm test                    # sandbox path-escape tests
npm run dev                 # http://localhost:3000/mcp
```
Generate a token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Try it in MCP Inspector
`npm run inspect` → transport **Streamable HTTP**, URL `http://localhost:3000/mcp`,
add header `Authorization: Bearer <your token>` → Connect → List Tools.

## Deploy
```bash
npm run build
npm i -g pm2
pm2 start ecosystem.config.cjs && pm2 save
ngrok http --url=<your-static-domain>.ngrok-free.app 3000
```
MCP endpoint: `https://<your-static-domain>.ngrok-free.app/mcp`
(clients that can't send headers can use `/mcp/<token>`; see tradeoffs in the report).

## Handoff protocol
On first boot the workspace is seeded from `workspace-template/`:
`PROJECT_STATE.md` (read first, update last), `PLAN_LOG.md` (append-only plan/progress),
`CHECKPOINTS.md` (end-of-session summary + commit), `DECISIONS.md` (why).

## Security
Sandbox root, path-escape rejection (`..`, absolute, null bytes, symlinks, `.git`), bearer-token auth,
destructive-action gating, 1 MB write cap, audit log. Details in `docs/REPORT.md`.

## Layout
`src/sandbox.ts` path safety · `src/tools.ts` tools · `src/server.ts` HTTP + auth · `test/` tests · `workspace-template/` handoff seeds
