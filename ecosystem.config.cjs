module.exports = {
  apps: [{
    name: "mcp-workspace",
    script: "dist/server.js",
    interpreter_args: "--env-file=.env",
    autorestart: true,
    max_restarts: 20,
    time: true
  }]
};
