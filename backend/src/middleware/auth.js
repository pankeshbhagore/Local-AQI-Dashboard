/**
 * Authentication & Authorization Middleware
 * authenticate — verifies JWT Bearer token
 * authorize    — checks user role against allowed list
 */
const jwt  = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-secret';

/**
 * Verifies the Bearer token and attaches payload to req.user.
 * Responds 401 if missing or invalid.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token   = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;   // { id, email, role, name }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-based authorization guard.
 * Must be used AFTER authenticate.
 * Usage: router.get('/admin', authenticate, authorize(['admin','superuser']), handler)
 */
function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error:    'Insufficient permissions',
        required: roles,
        current:  req.user.role,
      });
    }
    next();
  };
}

/**
 * Optional auth — attaches user if token present, continues without error if not.
 * Useful for public endpoints that behave differently for authenticated users.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const token   = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
  } catch { /* ignore */ }
  next();
}

module.exports = { authenticate, authorize, optionalAuth };
