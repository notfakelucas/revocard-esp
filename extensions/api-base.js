/*
 * Resolves relative /api/* paths against the right host.
 *
 * Every page already defines this inline as a defensive fallback before
 * loading this file (`window.apiUrl = window.apiUrl || function(p){...}`),
 * so this file just needs to exist (it was 404ing in production) — the
 * inline copy and this one must stay in sync.
 */
window.apiUrl = window.apiUrl || function (p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  var path = p.charAt(0) === '/' ? p : '/' + p;
  var host = location.hostname;
  var port = String(location.port || '');
  if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '8080') {
    return 'http://127.0.0.1:8080' + path;
  }
  return path;
};
