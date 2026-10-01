// Strips keys such as "$gt" or "a.b" from request input to block NoSQL operator injection.
const clean = (obj) => {
  if (Array.isArray(obj)) return obj.forEach(clean);
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) delete obj[key];
      else clean(obj[key]);
    }
  }
};
module.exports = (req, res, next) => {
  clean(req.body);
  clean(req.params);
  clean(req.query);
  next();
};
