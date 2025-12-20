module.exports = function requireRole(role) {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !user.roles) return res.status(401).json({ error: 'no user in session' });
      if (!user.roles.includes(role)) return res.status(403).json({ error: 'insufficient permissions' });
      next();
    } catch (err) {
      next(err);
    }
  };
};
