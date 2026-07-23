/**
 * PM2 process definition for the VPS.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * IMPORTANT: this app must run as exactly one process. Rooms live in the
 * memory of the process that created them (see src/server/rooms.ts), so a
 * second instance would serve players a room its own memory knows nothing
 * about. Do not switch this to cluster mode or raise `instances` until rooms
 * are backed by Redis.
 */
module.exports = {
  apps: [
    {
      name: "wavelength",
      cwd: "/var/www/wavelength",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        PORT: 3002,
        // Nginx is the only thing that should reach this port.
        HOST: "127.0.0.1",
      },

      // A restart drops every live room, so avoid churn: no watching, and a
      // generous memory ceiling.
      watch: false,
      max_memory_restart: "500M",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,

      time: true,
      merge_logs: true,
      error_file: "/home/tide/.pm2/logs/wavelength-error.log",
      out_file: "/home/tide/.pm2/logs/wavelength-out.log",
    },
  ],
};
