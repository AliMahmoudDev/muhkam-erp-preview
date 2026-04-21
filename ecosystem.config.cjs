/**
 * PM2 Ecosystem Configuration — MUHKAM ERP
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup
 *
 * الـ Backend يخدم كلا النسختين:
 *   /             → MUHKAM ULTIMATE  (artifacts/erp-system/dist/public)
 *   /muhkam-advanced/ → MUHKAM ADVANCED  (artifacts/muhkam-base/dist/public)
 *   /api/         → REST API (مشترك)
 */

/* تحميل متغيرات البيئة من ملف .env بدون حزمة خارجية */
const fs = require("fs");
const path = require("path");

const envFile = path.join("/var/www/muhkam-erp", ".env");
const env = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
}

module.exports = {
  apps: [
    {
      name: "halaltech-api",
      script: "./artifacts/api-server/dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      cwd: "/var/www/muhkam-erp",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        PORT: 8080,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        DATABASE_URL: env.DATABASE_URL,
        JWT_SECRET: env.JWT_SECRET,
        JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
        ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
        FRONTEND_DIST: "/var/www/muhkam-erp/artifacts/erp-system/dist/public",
        ADVANCED_DIST: "/var/www/muhkam-erp/artifacts/muhkam-base/dist/public",
      },
      error_file: "/var/log/pm2/halaltech-error.log",
      out_file: "/var/log/pm2/halaltech-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
