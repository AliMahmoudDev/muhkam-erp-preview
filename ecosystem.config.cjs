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
 *   /muhkam-base/ → MUHKAM ADVANCED  (artifacts/muhkam-base/dist/public)
 *   /api/         → REST API (مشترك)
 */
module.exports = {
  apps: [
    {
      name: "halaltech-api",
      script: "./artifacts/api-server/dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      cwd: "/var/www/muhkam",
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
        // DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS — حمّلها من .env أو أضفها هنا
        // FRONTEND_DIST: "/var/www/muhkam/artifacts/erp-system/dist/public",
        // ADVANCED_DIST:  "/var/www/muhkam/artifacts/muhkam-base/dist/public",
      },
      error_file: "/var/log/pm2/halaltech-error.log",
      out_file: "/var/log/pm2/halaltech-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
