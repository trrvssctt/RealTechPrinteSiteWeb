// Simple in-memory cache with TTL. Not shared across processes.
const cache = new Map();

function makeKey(prefix, obj) {
  return prefix + '|' + JSON.stringify(obj || {});
}

function set(prefix, keyObj, value, ttl = 30) {
  const key = makeKey(prefix, keyObj);
  const expires = Date.now() + ttl * 1000;
  cache.set(key, { value, expires });
}

function get(prefix, keyObj) {
  const key = makeKey(prefix, keyObj);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function del(prefix, keyObj) {
  const key = makeKey(prefix, keyObj);
  cache.delete(key);
}

function clear() {
  cache.clear();
}

module.exports = { set, get, del, clear };
