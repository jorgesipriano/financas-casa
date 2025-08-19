import * as SQLJS from "sql.js";
import { get, set, del } from "idb-keyval";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.wasm";
let SQL = null;
let db = null;
let currentWorkspace = null;

export async function openWorkspace(name) {
  if (!SQL) SQL = await (SQLJS.default || SQLJS)({ locateFile: () => WASM_PATH });
  currentWorkspace = name.trim().toLowerCase();
  const key = dbKey(currentWorkspace);
  const saved = await get(key);
  db = saved ? new SQL.Database(saved) : new SQL.Database();
  bootstrap();
  return true;
}

function dbKey(ws) { return `financas.sqlite.${ws}`; }

function bootstrap() {
  db.run(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT CHECK (tipo IN ('receita','despesa')) NOT NULL,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      data TEXT NOT NULL,
      classe TEXT CHECK (classe IN ('fixa','variavel','esporadica')) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tx_data ON transactions(data);
  `);
  migrate(); // novas colunas opcionais
}

function migrate() {
  const cols = colset("transactions");
  if (!cols.has("categoria")) db.run("ALTER TABLE transactions ADD COLUMN categoria TEXT;");
  if (!cols.has("conta")) db.run("ALTER TABLE transactions ADD COLUMN conta TEXT;");
  if (!cols.has("obs")) db.run("ALTER TABLE transactions ADD COLUMN obs TEXT;");
}

function colset(table) {
  const res = db.exec(`PRAGMA table_info(${table});`)[0]?.values || [];
  return new Set(res.map(r => String(r[1])));
}

export async function persist() {
  if (!db || !currentWorkspace) return;
  const data = db.export();
  await set(dbKey(currentWorkspace), data);
}

export async function resetWorkspace() {
  if (!currentWorkspace) return;
  await del(dbKey(currentWorkspace));
  db = null;
}

export function addTx({ tipo, descricao, valor, data, classe, categoria="", conta="", obs="" }) {
  const stmt = db.prepare("INSERT INTO transactions (tipo,descricao,valor,data,classe,categoria,conta,obs) VALUES (?,?,?,?,?,?,?,?)");
  stmt.run([tipo, descricao, Number(valor), data, classe, categoria, conta, obs]);
  stmt.free();
}

export function bulkAddTx(rows) {
  db.run("BEGIN");
  const stmt = db.prepare("INSERT INTO transactions (tipo,descricao,valor,data,classe,categoria,conta,obs) VALUES (?,?,?,?,?,?,?,?)");
  for (const r of rows) stmt.run([r.tipo, r.descricao, Number(r.valor), r.data, r.classe, r.categoria||"", r.conta||"", r.obs||""]);
  stmt.free();
  db.run("COMMIT");
}

export function listMonthsYears() {
  const res = db.exec(`
    SELECT DISTINCT strftime('%m', data) as mes, strftime('%Y', data) as ano
    FROM transactions ORDER BY ano DESC, mes DESC
  `);
  const rows = res[0]?.values || [];
  return rows.map(([mes, ano]) => ({ mes, ano }));
}

export function query({ mes, ano, classe, tipo }) {
  let sql = "SELECT id,tipo,descricao,valor,data,classe,categoria,conta,obs FROM transactions WHERE 1=1";
  const params = [];
  if (mes) { sql += " AND strftime('%m', data)=?"; params.push(mes.padStart(2,"0")); }
  if (ano) { sql += " AND strftime('%Y', data)=?"; params.push(ano); }
  if (classe) { sql += " AND classe=?"; params.push(classe); }
  if (tipo) { sql += " AND tipo=?"; params.push(tipo); }
  sql += " ORDER BY date(data) DESC, id DESC";
  const stmt = db.prepare(sql);
  const out = [];
  while (stmt.step()) {
    const [id,tipo,descricao,valor,data,classe,categoria,conta,obs] = stmt.get();
    out.push({ id, tipo, descricao, valor, data, classe, categoria, conta, obs });
  }
  stmt.free();
  return out;
}

export function kpis({ mes, ano }) {
  const getVal = (sql, params=[]) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let v = 0;
    if (stmt.step()) v = stmt.get()[0] || 0;
    stmt.free();
    return v;
  };
  const r = getVal("SELECT COALESCE(SUM(valor),0) FROM transactions WHERE tipo='receita' AND strftime('%m',data)=? AND strftime('%Y',data)=?", [mes.padStart(2,"0"), ano]);
  const d = getVal("SELECT COALESCE(SUM(valor),0) FROM transactions WHERE tipo='despesa' AND strftime('%m',data)=? AND strftime('%Y',data)=?", [mes.padStart(2,"0"), ano]);
  const saldoTotal = getVal("SELECT COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END),0) FROM transactions");
  return { receitas: r, despesas: d, saldo: saldoTotal };
}

export function deleteTx(id) {
  const stmt = db.prepare("DELETE FROM transactions WHERE id=?");
  stmt.run([id]);
  stmt.free();
}

export function updateTx(row) {
  const stmt = db.prepare(`UPDATE transactions
    SET tipo=?, descricao=?, valor=?, data=?, classe=?, categoria=?, conta=?, obs=? WHERE id=?`);
  stmt.run([row.tipo,row.descricao,Number(row.valor),row.data,row.classe,row.categoria||"",row.conta||"",row.obs||"",row.id]);
  stmt.free();
}