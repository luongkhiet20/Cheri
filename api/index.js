const { app, connectToMongo } = require('../server/admin-server');

module.exports = async (req, res) => {
  await connectToMongo();
  return app(req, res);
};
