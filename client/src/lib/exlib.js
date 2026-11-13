// Bibliothèque illustrée (free-exercise-db, domaine public) : chargée à la demande, photos servies par GitHub
let cache = null;
export const loadLib = () => (cache ||= import('../data/exlib.json').then((m) => m.default));
const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
export const imgs = (x) => (x?.img ? Array.from({ length: x.img }, (_, i) => `${IMG}${x.id}/${i}.jpg`) : []);
export const thumb = (libId) => (libId && !libId.startsWith('x_') ? `${IMG}${libId}/0.jpg` : null);
export const CATS = { muscu: 'Muscu', crossfit: 'Crossfit', mobilite: 'Mobilité', cardio: 'Cardio' };
export const LEVELS = { b: 'Débutant', i: 'Intermédiaire', e: 'Avancé' };
export const MUSCLE_FR = {
  abdominals: 'Abdominaux', abductors: 'Abducteurs', adductors: 'Adducteurs', biceps: 'Biceps', calves: 'Mollets', chest: 'Pectoraux', forearms: 'Avant-bras',
  glutes: 'Fessiers', hamstrings: 'Ischio-jambiers', lats: 'Grand dorsal', 'lower back': 'Lombaires', 'middle back': 'Milieu du dos', neck: 'Nuque',
  quadriceps: 'Quadriceps', shoulders: 'Épaules', traps: 'Trapèzes', triceps: 'Triceps',
};
// Ce que le serveur attend pour créer l'exercice (une seule fois par exercice de la bibliothèque)
export const toExercise = (x) => ({ lib_id: x.id, name: x.n, pattern: x.pt, muscles: x.m, equipment: x.q, kind: x.k, default_unit: 'lbs' });
export const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export async function findLib(id) { if (!id) return null; return (await loadLib()).find((x) => x.id === id) || null; }
export const MUSCLES_APP = { pectoraux: 'Pectoraux', epaules_ant: 'Épaules (avant)', epaules_lat: 'Épaules (latéral)', epaules_post: 'Épaules (arrière)', triceps: 'Triceps', biceps: 'Biceps', avant_bras: 'Avant-bras', dos_largeur: 'Grand dorsal', dos_epaisseur: 'Milieu du dos', trapezes: 'Trapèzes', lombaires: 'Lombaires', abdominaux: 'Abdominaux', quadriceps: 'Quadriceps', ischios: 'Ischio-jambiers', fessiers: 'Fessiers', adducteurs: 'Adducteurs', abducteurs: 'Abducteurs', mollets: 'Mollets' };
