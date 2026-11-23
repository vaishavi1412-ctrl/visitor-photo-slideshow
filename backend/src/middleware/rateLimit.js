// Very simple limiter: each IP address gets "max" tries per "windowMs".
// It stops people from guessing visitor codes again and again.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);

    if (!entry || entry.resetAt < now) {
      hits.set(req.ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}