// Adaptateur sql.js -> API de node:sqlite (prepare().get/all/run, exec)
const norm = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

export function wrap(raw) {
  const prep = (sql) => ({
    get(...p) { const st = raw.prepare(sql); try { st.bind(norm(p)); return st.step() ? st.getAsObject() : undefined; } finally { st.free(); } },
    all(...p) { const st = raw.prepare(sql); const out = []; try { st.bind(norm(p)); while (st.step()) out.push(st.getAsObject()); return out; } finally { st.free(); } },
    run(...p) {
      const st = raw.prepare(sql);
      try { st.bind(norm(p)); while (st.step()) { /* consomme */ } } finally { st.free(); }
      const changes = raw.getRowsModified();
      const id = raw.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0];
      return { changes, lastInsertRowid: id };
    },
  });
  return { raw, prepare: prep, exec: (sql) => raw.exec(sql) };
}
