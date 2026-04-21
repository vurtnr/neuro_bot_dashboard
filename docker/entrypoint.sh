#!/bin/sh
set -eu

mkdir -p /app/public

node <<'EOF'
const fs = require("fs");

const config = {
  NEXT_PUBLIC_ROBOT_BASE_URL: process.env.NEXT_PUBLIC_ROBOT_BASE_URL || "",
  NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL:
    process.env.NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL || "",
  NEXT_PUBLIC_PLANT_CREATED_WS_URL:
    process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL || "",
  NEXT_PUBLIC_TIANDITU_KEY: process.env.NEXT_PUBLIC_TIANDITU_KEY || "",
};

fs.writeFileSync(
  "/app/public/runtime-config.js",
  `window.__ROBOT_DASHBOARD_RUNTIME_CONFIG__ = ${JSON.stringify(config)};\n`,
  "utf8",
);
EOF

exec node server.js
