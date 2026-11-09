// Mini-routeur compatible avec l'usage d'Express dans server/routes (version autonome dans le navigateur)
export function Router() {
  const routes = [];
  const add = (method) => (pattern, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler });
  };
  return { routes, get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE'), use() {} };
}
export default { Router };
