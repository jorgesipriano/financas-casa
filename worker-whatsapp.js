/* Cloudflare Worker exemplo de webhook para WhatsApp (Meta Cloud API ou Twilio).
   Objetivo: receber texto, normalizar e devolver JSON de transações.
   Implemente a persistência no seu backend conforme necessário.
*/
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function parse(text) {
  const today = new Date().toISOString().slice(0,10);
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^([+\-])\s*([\d.,]+)\s+(.+)$/i);
    if (m) {
      const sign = m[1] === "+" ? 1 : -1;
      const valor = Math.abs(parseFloat(m[2].replace(/\./g,"").replace(",", ".")));
      const desc = m[3];
      const classe = normClasse(desc) || guessClasse(desc);
      out.push({
        tipo: sign > 0 ? "receita" : "despesa",
        descricao: desc.replace(/\b(fixa|variavel|variável|esporadica|esporádica)\b/ig, "").trim(),
        valor,
        data: today,
        classe
      });
    }
  }
  return out;
}
function normClasse(txt="") {
  const t = txt.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
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

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("Use POST", { status:405, headers: cors });
    const contentType = req.headers.get("content-type") || "";
    let text = "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      // Ajuste conforme provedor. Exemplos:
      // Twilio: body.Body
      // Meta WhatsApp Cloud: body.entry[0].changes[0].value.messages[0].text.body
      text = body.Body || body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || "";
    } else {
      text = await req.text();
    }
    const items = parse(text);
    return new Response(JSON.stringify({ items }), {
      headers: { "content-type":"application/json", ...cors }
    });
  }
};

