/**
 * server.js - Shortcut wrapper to start the backend server
 *
 * Để chạy toàn bộ hệ thống phát triển (NestJS backend + Admin API server):
 *   npm run start:dev
 *
 * Để chạy frontend:
 *   npm run start:client
 *
 * Chạy trực tiếp file này (node server.js):
 *   Khởi động backend server (admin-server.js) trên cổng 5000
 */

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}

const { app, connectToMongo } = require('./server/admin-server.js');
const PORT = process.env.ADMIN_PORT || process.env.PORT_ADMIN || 5000;

connectToMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(` Backend API server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(' MongoDB Connection Error:', err);
    process.exit(1);
  });
