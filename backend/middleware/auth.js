const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail loud in the console at startup — a missing secret means every token
  // would be signed/verified with 'undefined', which is not safe.
  console.warn(
    'WARNING: JWT_SECRET is not set in your .env file. Add a line like: JWT_SECRET=<any long random string>'
  );
}

// Protects a route: requires an "Authorization: Bearer <token>" header.
// On success it sets req.userId; on failure it responds 401 and stops.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Login required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

module.exports = { requireAuth, JWT_SECRET };