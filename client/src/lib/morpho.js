// Profil morphologique en cache (fiches exercices, carte du corps) ; rechargé après chaque modification
import { get } from './api.js';
let p = null;
export const loadMorpho = () => (p ||= get('/morpho').catch(() => null));
export const resetMorpho = () => { p = null; };
