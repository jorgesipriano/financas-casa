import { openWorkspace, addTx, bulkAddTx, query, kpis, listMonthsYears, persist, deleteTx, updateTx } from "./db.js";
import { ideas, formatCurrencyBRL, jurosCompostos } from "./investment-ideas.js";

const els = {
  authHint: document.getElementById("authHint"),
  dash: document.getElementById("dashboard"),
  wsInput: document.getElementById("workspaceInput"),
  wsBtn: document.getElementById("enterWorkspaceBtn"),
  kpiSaldo: document.getElementById("kpiSaldo"),
  kpiReceitas: document.getElementById("kpiReceitas"),
  kpiDespesas: document.getElementById("kpiDespesas"),
  txForm: document.getElementById("txForm"),
  txId: document.getElementById("txId"),
  txTipo: document.getElementById("txTipo"),
  txDesc: document.getElementById("txDescricao"),
  txValor: document.getElementById("txValor"),
  txData: document.getElementById("txData"),
  txClasse: document.getElementById("txClasse"),
  txCategoria: document.getElementById("txCategoria"),
  txConta: document.getElementById("txConta"),
  txObs: document.getElementById("txObs"),
  txRepeat: document.getElementById("txRepeat"),
  txList: document.getElementById("txList"),
  fMes: document.getElementById("fMes"),
  fAno: document.getElementById("fAno"),
  fClasse: document.getElementById("fClasse"),
  fTipo: document.getElementById("fTipo"),
  importBox: document.getElementById("importBox"),
  parseBtn: document.getElementById("btnParseImport"),
  applyBtn: document.getElementById("btnApplyImport"),
  importPreview: document.getElementById("importPreview"),
  ideas: document.getElementById("ideas"),
  cInicial: document.getElementById("cInicial"),
  cMensal: document.getElementById("cMensal"),
  cTaxa: document.getElementById("cTaxa"),
  cMeses: document.getElementById("cMeses"),
  calcBtn: document.getElementById("calcBtn"),
  calcOut: document.getElementById("calcOut"),
  btnExport: document.getElementById("btnExportCsv"),
  btnCancelEdit: document.getElementById("btnCancelEdit"),
  btnClearFilters: document.getElementById("btnClearFilters"),
};

let currentFilters = { mes: pad2(new Date().getMonth() + 1), ano: String(new Date().getFullYear()), classe: "", tipo: "" };
let parsedImport = [];
let categoryChart = null;

els.wsBtn.addEventListener("click", async () => {
  const name = els.wsInput.value.trim();
  if (!name) return alert("Informe um espaço de trabalho.");
  await openWorkspace(name);
  els.authHint.classList.add("hidden");
  els.dash.classList.remove("hidden");
  initFilters();
  refresh();
});

els.txForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = Number(els.txId.value);
  const data = {
    tipo: els.txTipo.value,
    descricao: els.txDesc.value.trim(),
    valor: Number(els.txValor.value),
    data: els.txData.value || new Date().toISOString().slice(0, 10),
    classe: els.txClasse.value,
    categoria: els.txCategoria.value.trim(),
    conta: els.txConta.value.trim(),
    obs: els.txObs.value.trim()
  };

  if (id) {
    updateTx({ ...data, id: id });
  } else {
    const repeat = Math.max(1, Number(els.txRepeat.value || 1));
    for (let i = 0; i < repeat; i++) {
      const d = addMonthsISO(data.data, i);
      addTx({ ...data, data: d });
    }
  }

  await persist();
  resetForm();
  refresh();
});

els.btnCancelEdit.addEventListener("click", () => {
  resetForm();
});

function resetForm() {
  els.txForm.reset();
  els.txId.value = "";
  els.txRepeat.disabled = false;
  els.txForm.querySelector("button[type='submit']").textContent = "Adicionar";
  els.btnCancelEdit.classList.add("hidden");
}

function initFilters() {
  const months = [
    ["01", "Jan"], ["02", "Fev"], ["03", "Mar"], ["04", "Abr"], ["05", "Mai"], ["06", "Jun"],
    ["07", "Jul"], ["08", "Ago"], ["09", "Set"], ["10", "Out"], ["11", "Nov"], ["12", "Dez"]
  ];
  els.fMes.innerHTML = months.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  els.fMes.value = currentFilters.mes;
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => String(anoAtual - i));
  els.fAno.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join("");
  els.fAno.value = currentFilters.ano;
  for (const el of [els.fMes, els.fAno, els.fClasse, els.fTipo]) {
    el.addEventListener("change", () => {
      currentFilters = {
        mes: els.fMes.value,
        ano: els.fAno.value,
        classe: els.fClasse.value,
        tipo: els.fTipo.value
      };
      refresh();
    });
  }
}

function refresh() {
  const rows = query(currentFilters);
  renderTx(rows);
  const k = kpis({ mes: currentFilters.mes, ano: currentFilters.ano });
  els.kpiSaldo.textContent = formatCurrencyBRL(k.saldo);
  els.kpiReceitas.textContent = formatCurrencyBRL(k.receitas);
  els.kpiDespesas.textContent = formatCurrencyBRL(k.despesas);
  renderIdeas();
  renderCharts(rows);
}

function renderTx(rows) {
  if (!rows.length) {
    els.txList.innerHTML = `<div class="muted">Sem lançamentos para o filtro.</div>`;
    return;
  }
  els.txList.innerHTML = rows.map(r => `
    <div class="tx-row" data-id="${r.id}">
      <div class="tipo">${r.tipo === "receita" ? "Receita" : "Despesa"}</div>
      <div class="desc">
        <strong>${escapeHtml(r.descricao)}</strong>
        <div class="small muted">${escapeHtml(r.categoria || "-")} • ${escapeHtml(r.conta || "-")}${r.obs ? " • " + escapeHtml(r.obs) : ""}</div>
      </div>
      <div class="valor ${r.tipo === "receita" ? "pos" : "neg"}">${formatCurrencyBRL(r.valor)}</div>
      <div class="data">${fmtDateBR(r.data)}</div>
      <div class="classe">${cap(r.classe)}</div>
      <div class="tx-actions">
        <button class="edit">Editar</button>
        <button class="del">Excluir</button>
      </div>
    </div>
  `).join("");
}

els.txList.addEventListener("click", async (e) => {
  const row = e.target.closest(".tx-row");
  if (!row) return;
  const id = Number(row.dataset.id);

  if (e.target.classList.contains("del")) {
    if (!confirm("Excluir esta transação?")) return;
    deleteTx(id); await persist(); refresh(); return;
  }

  if (e.target.classList.contains("edit")) {
    const item = query({}).find(x => x.id === id);
    if (!item) return;

    els.txId.value = item.id;
    els.txTipo.value = item.tipo;
    els.txDesc.value = item.descricao;
    els.txValor.value = item.valor;
    els.txData.value = item.data;
    els.txClasse.value = item.classe;
    els.txCategoria.value = item.categoria || "";
    els.txConta.value = item.conta || "";
    els.txObs.value = item.obs || "";
    els.txRepeat.value = "1";
    els.txRepeat.disabled = true;

    els.txForm.querySelector("button[type='submit']").textContent = "Atualizar";
    els.btnCancelEdit.classList.remove("hidden");
    els.txDesc.focus();
  }
});

els.parseBtn.addEventListener("click", () => {
  const text = els.importBox.value.trim();
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  parsedImport = parseLines(lines);
  if (!parsedImport.length) {
    els.importPreview.innerHTML = `<div class="muted">Nada reconhecido.</div>`;
    els.applyBtn.disabled = true;
    return;
  }
  els.importPreview.innerHTML = parsedImport.map(r => `
    <div class="tx-row">
      <div class="tipo">${r.tipo === "receita" ? "Receita" : "Despesa"}</div>
      <div class="desc">${escapeHtml(r.descricao)}</div>
      <div class="valor ${r.tipo === "receita" ? "pos" : "neg"}">${formatCurrencyBRL(r.valor)}</div>
      <div class="data">${fmtDateBR(r.data)}</div>
      <div class="classe">${cap(r.classe)}</div>
    </div>
  `).join("");
  els.applyBtn.disabled = false;
});

els.applyBtn.addEventListener("click", async () => {
  if (!parsedImport.length) return;
  bulkAddTx(parsedImport);
  await persist();
  parsedImport = [];
  els.importPreview.innerHTML = "";
  els.applyBtn.disabled = true;
  els.importBox.value = "";
  refresh();
});

els.calcBtn.addEventListener("click", () => {
  const P = num(els.cInicial.value);
  const A = num(els.cMensal.value);
  const i = num(els.cTaxa.value) / 100;
  const n = Math.max(0, Math.floor(num(els.cMeses.value)));
  const total = jurosCompostos(P, A, i, n);
  els.calcOut.textContent = `Valor futuro: ${formatCurrencyBRL(total)} em ${n} meses`;
});

els.btnExport.addEventListener("click", () => {
  const rows = query(currentFilters);
  const header = ["id", "tipo", "descricao", "valor", "data", "classe", "categoria", "conta", "obs"];
  const csv = [header.join(",")].concat(rows.map(r =>
    header.map(k => csvCell(r[k])).join(",")
  )).join("\n");
  downloadText(csv, `transacoes_${currentFilters.ano}-${currentFilters.mes}.csv`, "text/csv");
});

els.btnClearFilters.addEventListener("click", () => {
  currentFilters = { mes: pad2(new Date().getMonth() + 1), ano: String(new Date().getFullYear()), classe: "", tipo: "" };
  els.fMes.value = currentFilters.mes;
  els.fAno.value = currentFilters.ano;
  els.fClasse.value = "";
  els.fTipo.value = "";
  refresh();
});

function addMonthsISO(dateStr, add) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1 + add, d);
  return dt.toISOString().slice(0, 10);
}
function csvCell(v) {
  const s = (v == null ? "" : String(v)).replace(/"/g, '""');
  return `"${s}"`;
}
function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function renderIdeas() {
  if (els.ideas.dataset.rendered) return;
  els.ideas.innerHTML = ideas.map(it => `
    <div class="idea">
      <div class="row space-between">
        <strong>${escapeHtml(it.titulo)}</strong>
        <span class="muted small">${escapeHtml(it.risco)}</span>
      </div>
      <p class="small">${escapeHtml(it.desc)}</p>
      <p class="small muted">Horizonte: ${escapeHtml(it.horizonte)}</p>
    </div>
  `).join("");
  els.ideas.dataset.rendered = "1";
}

function parseLines(lines) {
  const out = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const line of lines) {
    const csv = line.split(",");
    if (csv.length >= 3 && /(receita|despesa)/i.test(csv[0])) {
      const [tipo, descricao, valor, data, classe, categoria = "", conta = "", obs = ""] = csv.map(s => s.trim());
      out.push({
        tipo: tipo.toLowerCase(),
        descricao,
        valor: Number(valor.replace(",", ".")),
        data: data || today,
        classe: normClasse(classe) || guessClasse(descricao),
        categoria, conta, obs
      });
      continue;
    }
    const m = line.match(/^([+\-])\s*([\d.,]+)\s+(.+)$/i);
    if (m) {
      const sign = m[1] === "+" ? 1 : -1;
      const valor = Math.abs(parseFloat(m[2].replace(/\./g, "").replace(",", ".")));
      const desc = m[3];
      const classe = normClasse(desc) || guessClasse(desc);
      out.push({
        tipo: sign > 0 ? "receita" : "despesa",
        descricao: desc.replace(/\b(fixa|variavel|variável|esporadica|esporádica)\b/ig, "").trim(),
        valor,
        data: today,
        classe,
        categoria: "", conta: "", obs: ""
      });
    }
  }
  return out;
}

function renderCharts(rows) {
  const expenses = rows.filter(r => r.tipo === 'despesa');
  const byCategory = expenses.reduce((acc, tx) => {
    const cat = tx.categoria || "Sem Categoria";
    acc[cat] = (acc[cat] || 0) + tx.valor;
    return acc;
  }, {});

  const labels = Object.keys(byCategory);
  const data = Object.values(byCategory);

  const ctx = document.getElementById('categoryChart').getContext('2d');

  if (categoryChart) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = data;
    categoryChart.update();
  } else {
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Despesas',
          data: data,
          backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'],
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
        }
      }
    });
  }
}

function normClasse(txt = "") {
  const t = txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (t.includes("fixa")) return "fixa";
  if (t.includes("variavel")) return "variavel";
  if (t.includes("esporadica")) return "esporadica";
  return "";
}

function guessClasse(desc) {
  const t = desc.toLowerCase();
  if (/(aluguel|academia|internet|plano|salario|salário)/.test(t)) return "fixa";
  if (/(mercado|uber|ifood|lanche|lazer|bar|restaurante)/.test(t)) return "variavel";
  return "esporadica";
}

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtDateBR(d) { const [y, m, da] = d.split("-"); return `${da}/${m}/${y}`; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(s) { return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#039;" }[m])); }
function num(v) { return Number((v || "0").toString().replace(",", ".")) || 0; }
