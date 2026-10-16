# Report: MCP Workspace Server  (fill in; aim for 1-2 pages)

## 1. Stack and why
- Runtime/SDK: Node.js + official TS SDK because ...
- Transport: Streamable HTTP (stateless) because ... (stdio can't be reached by remote clients)
- Validation: zod because the SDK derives the JSON schema from it, so schema = validation
- Exposure: ngrok static domain because ...
- Process manager: pm2 because it restarts on crash/reboot (`pm2 save`, `pm2 startup`)
- Version control: git on the host; agents get git-lite tools only (no arbitrary shell)

## 2. Tool design choices
- 9 single-purpose tools; descriptions say when to use each and what they return
- Efficiency by design: read_file chunks (offset/limit) + search_files instead of whole-file reads
- Errors return isError with a next-step hint (e.g. "File not found... try list_files")
- write_file if_version (optimistic locking) prevents two agents overwriting each other
- str_replace requires a unique match so edits are precise and small
- Handoff files: PROJECT_STATE / PLAN_LOG / CHECKPOINTS / DECISIONS

## 3. Security tradeoffs
| Threat | Mitigation | Remaining risk |
|---|---|---|
| Path traversal / symlink escape | resolveSafe + tests | TOCTOU race between check and use |
| Open public endpoint | Bearer token (env var) | Token in /mcp/<token> URL can appear in logs; single shared secret, no rotation/OAuth |
| Destructive actions | delete_file needs confirm=true, audit log | Agent can still delete files it is allowed to; git history is the safety net |
| Tampering with git internals | .git blocked in sandbox | git_commit stages everything |
| Resource abuse | 1 MB write cap, capped list/search | No rate limiting |
| Secrets | .env, gitignored | ... |

## 4. Evidence
- Transcript: (link/file) of the 2-session task
- Logs: logs/tool_calls.jsonl, PLAN_LOG.md, CHECKPOINTS.md
- What I would improve with more time: ...
