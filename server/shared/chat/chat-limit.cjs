const crypto = require('node:crypto');
const net = require('node:net');

const LIMIT = 10;
const WINDOW_MS = 60_000;
const INDEXES = new WeakMap();

function stableClientAddress(request, trustedVercel = process.env.VERCEL === '1') {
  if (trustedVercel) {
    const forwarded = request?.headers?.['x-forwarded-for'];
    const address = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
    return net.isIP(address) ? address : 'unknown';
  }
  const address = request?.socket?.remoteAddress;
  return typeof address === 'string' && net.isIP(address) ? address : 'unknown';
}

function digestAddress(address) {
  return crypto.createHash('sha256').update(String(address || 'unknown')).digest('hex');
}

function createMongoLimiter(getDb) {
  return {
    async consume(clientAddress, nowMs = Date.now()) {
      if (!Number.isFinite(nowMs)) throw new Error('Invalid chat limiter clock');
      const db = await getDb();
      let indexesReady = INDEXES.get(db);
      if (!indexesReady) {
        indexesReady = Promise.resolve(db.collection('chat_rate_limits')
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })).catch((error) => {
          INDEXES.delete(db);
          throw error;
        });
        INDEXES.set(db, indexesReady);
      }
      await indexesReady;

      const windowStart = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
      const bucket = `${digestAddress(clientAddress)}:${windowStart}`;
      const collection = db.collection('chat_rate_limits');
      const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + WINDOW_MS * 2) } };
      let document;
      try {
        document = await collection.findOneAndUpdate(
          { _id: bucket }, update, { upsert: true, returnDocument: 'after' },
        );
      } catch (error) {
        if (error?.code !== 11000) throw error;
        await collection.updateOne({ _id: bucket }, { $inc: { count: 1 } });
        document = await collection.findOne({ _id: bucket });
      }
      const count = Number(document?.count ?? document?.value?.count);
      if (!Number.isFinite(count)) throw new Error('Chat limiter returned no counter');
      return {
        allowed: count <= LIMIT,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + WINDOW_MS - nowMs) / 1000)),
      };
    },
  };
}

module.exports = {
  createMongoLimiter,
  resolveClientKey: stableClientAddress,
  stableClientAddress,
  digestAddress,
};
