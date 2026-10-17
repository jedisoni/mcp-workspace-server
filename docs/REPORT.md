# Report: MCP Workspace Server

**Name:** Panopio, Jed Edison P. · 
**Course:** CS 3A / CS 3B Elective · 
**Project:** Midterms Pt 1, Build Your Own MCP
**Repo:** https://github.com/jedisoni/mcp-workspace-server

## 1. What I built

A sandboxed MCP file-server connector with 9 tools, served over HTTPS through an ngrok tunnel and kept alive by pm2. I connected it to a real MCP client (Claude, as a custom connector) and ran one multi-step task across two separate agent sessions, using handoff files in the workspace as shared memory.

## 2. Stack and why

| Layer | Choice | Why |
|---|---|---|
| Runtime and SDK | Node.js 20+ with the official TypeScript MCP SDK | Reference choice; the SDK derives each tool's JSON schema from zod, so the schema and the validation are the same object. |
| Transport | Streamable HTTP, stateless (a fresh server and transport per request) | Remote clients cannot use stdio. Stateless means a restart or crash loses no session state, so the server survives a restart. |
| Validation | zod schemas on every tool input | Strict types, defaults, min/max limits and `z.literal(true)` for the delete confirmation. |
| Exposure | ngrok with a free static domain | Stable HTTPS URL, no server to rent; fine for a course demo. |
| Process manager | pm2 | Restarts on crash and keeps the server running in the background. |
| Version control | git on the host, exposed to agents only as git-lite tools | Agents get status, commit and log, but no arbitrary shell. |

Config and secrets live in environment variables (`.env`, gitignored). The code is split into `sandbox.ts` (path safety), `tools.ts` (tools) and `server.ts` (HTTP and auth).

## 3. Tool design choices

- **Nine single-purpose tools:** `list_files`, `read_file`, `write_file`, `str_replace`, `delete_file`, `search_files`, `git_status`, `git_commit`, `git_log`. Each description says when to use it and what it returns.
- **Built for small outputs:** `read_file` reads in line chunks (`offset`, `limit`) and tells the agent how to fetch the next chunk. `search_files` returns capped `path:line:text` hits, so an agent can search instead of reading whole files. `list_files` is non-recursive and capped at 200 entries.
- **Precise edits:** `str_replace` only succeeds if the text matches exactly once, so edits stay small and ambiguous edits fail loudly.
- **Concurrency guard (stretch):** `read_file` returns a version hash, and `write_file` accepts an optional `if_version`. If the file changed since the agent read it, the write is refused. This stops two agents overwriting each other.
- **Helpful errors:** every failure returns `isError` with a short message and a next step (for example, "File not found... try list_files or search_files"). No stack traces reach the client.
- **Audit log:** every call, successful or not, is appended to `logs/tool_calls.jsonl` with its arguments (long strings truncated).
- **Handoff protocol:** the workspace is seeded with `PROJECT_STATE.md` (read first, update last), `PLAN_LOG.md`, `CHECKPOINTS.md` and `DECISIONS.md`.

## 4. Security and sandboxing

**Path safety.** Every path goes through `resolveSafe()`, which resolves against the workspace root and rejects: absolute paths, null bytes, empty paths, `..` escapes, any `.git` segment, and symlinks that resolve outside the root. Six automated tests cover this and all pass. (On Windows, creating a symlink needs elevated rights, so the symlink test uses a junction.) Live check in MCP Inspector: `read_file` on `../.env` returned `Error: Path escapes the workspace.` and the attempt was logged.

**Authentication.** The `/mcp` endpoint requires a secret. The server accepts either an `Authorization: Bearer` header or the token in the URL path (`/mcp/<token>`), compared in constant time. Claude's custom connector form cannot send custom headers, so the demo used the path form with the connector set to "No sign-in".

**Destructive actions.** `delete_file` needs `confirm: true`, only deletes single files, refuses the workspace root, and is audit-logged. In the client I left `delete_file` on "needs approval" and allowed the other tools.

### Threats and remaining risks

| Threat | Mitigation | Remaining risk |
|---|---|---|
| Path traversal / symlink escape | `resolveSafe()` plus tests | A small race between the check and the file operation (TOCTOU). |
| Public endpoint | Secret token (env var), constant-time compare | The path form puts the secret in the URL, where it can appear in logs and in ngrok's request list. One shared secret, no rotation, no OAuth. The connector UI itself warns that anyone with the URL can use it. |
| Destructive actions | Confirmation flag, client-side approval, audit log, git history | An agent can still delete files inside the workspace; git is the recovery path. |
| Tampering with git internals | `.git` blocked in the sandbox; git runs with `execFile` and argument arrays (no shell) | `git_commit` stages everything in the workspace. |
| Resource abuse | 1 MB write cap, capped list and search results | No rate limiting. |
| Leaked secrets | `.env` gitignored; tokens redacted from evidence | Tokens appeared in my screenshots while debugging, so I rotate `MCP_AUTH_TOKEN` and the ngrok authtoken after grading. |

## 5. Evidence and results

- **Inspector:** all 9 tools listed over Streamable HTTP; `list_files` returned the four handoff files; the traversal attempt was blocked.
- **Real client:** Claude connected to `https://faucet-bubbling-icing.ngrok-free.dev` as a custom connector (ngrok's request log shows `POST /mcp/... 200 OK`).
- **Multi-step task across 2 sessions** (a Python command-line todo app in `todo-app/`):
  - *Session 1:* read `PROJECT_STATE.md`, wrote its plan to `PLAN_LOG.md` before acting, scaffolded the app with `add` and `list`, updated the state and checkpoint files, recorded decisions, and committed (`0479a7f`).
  - *Session 2 (new chat):* resumed from the handoff files, not chat history. Midway the connector dropped and four calls failed. The agent stopped instead of retrying in a loop and reported exactly what was and was not saved. After I restored the connection it finished: tests, README, plan log, final checkpoint, commit (`8e5564f`). It also noticed from reading the code that `done` and `delete` already existed, and corrected the stale docs.
- **Verification:** the agent had no code-execution tool and said so. I ran the 7 unit tests it wrote myself: 7 of 7 passed.
- **Files:** `evidence/` holds the tool-call log, the four handoff files, the workspace git log and both session transcripts.

## 6. Problems I hit and what I learned

- **DNS:** my router's DNS could not resolve the new ngrok domain. `nslookup` against 8.8.8.8 worked, and `curl --resolve` proved the tunnel end to end. Cloud clients are unaffected because they resolve the domain from their own servers.
- **Connection drops:** a laptop restart or unstable Wi-Fi takes down both the tunnel and, on Windows, pm2 (pm2 cannot auto-start at boot there). The recovery is one command each; the workspace and git history are on disk and survive. A small VPS with pm2 or systemd would fix this properly.
- **Client limits:** the Free plan allows one custom connector, and a connector that returns 404 (an offline tunnel) can be misreported as "asked for sign-in".

## 7. What I would improve

OAuth or a header-only token with rotation, rate limiting, `search_code` and a repo map, a code-execution tool so agents can run tests themselves, and a hosted deployment with auto-start.
