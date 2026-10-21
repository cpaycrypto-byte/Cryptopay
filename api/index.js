const app = require('../server');

// Export serverless handler for Vercel
module.exports = (req, res) => {
  // Ensure req.url retains /api prefix so Express routes (/api/login, /api/user, etc.) always match
  if (req.url && !req.url.startsWith('/api/') && req.url !== '/api') {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
