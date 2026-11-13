// Apparence : clair de 7 h à 19 h, sombre le soir (ou choix fixe dans les réglages)
const KEY = 'gt_theme';
export const getThemePref = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
export const resolveTheme = (pref = getThemePref(), d = new Date()) => (pref === 'light' || pref === 'dark' ? pref : (d.getHours() >= 7 && d.getHours() < 19 ? 'light' : 'dark'));
export function applyTheme() {
  const t = resolveTheme(); const root = document.documentElement;
  if (root.dataset.theme !== t) {
    root.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F4F6F9' : '#0B0D12');
    window.dispatchEvent(new Event('gt-theme'));
  }
  return t;
}
export function setThemePref(p) { try { localStorage.setItem(KEY, p); } catch { /* navigation privée */ } applyTheme(); }
export function watchTheme() {
  applyTheme();
  setInterval(applyTheme, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyTheme(); });
}
