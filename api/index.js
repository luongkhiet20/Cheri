const { app, connectToMongo } = require('../server/admin-server');

function createApiHandler({ app: expressApp, connectToMongo: connect }) {
  return async (req, res) => {
    try {
      await connect();
    } catch {
      const path = req.originalUrl || req.url || '';
      if (req.method === 'POST' && /^\/api\/chat(?:\?|$)/.test(path)) {
        return res.status(503).json({
          error: { code: 'CHAT_UNAVAILABLE', message: 'Chat hiện chưa thể phản hồi. Bạn thử lại sau nhé.' },
        });
      }
      throw new Error('Backend database connection failed');
    }
    return expressApp(req, res);
  };
}

const apiHandler = createApiHandler({ app, connectToMongo });
apiHandler.createApiHandler = createApiHandler;
module.exports = apiHandler;
