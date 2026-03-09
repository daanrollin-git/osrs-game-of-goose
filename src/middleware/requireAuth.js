function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  const isApiRequest = (req.originalUrl && req.originalUrl.startsWith('/api')) ||
    (req.headers && req.headers['content-type'] && req.headers['content-type'].includes('application/json')) ||
    req.xhr;
  if (isApiRequest) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.redirect('/login');
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
