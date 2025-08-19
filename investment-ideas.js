/* ...existing code... */
export const ideas = [
  { titulo:"Tesouro Selic", risco:"Baixo", horizonte:"Curto prazo", desc:"Reserva de emergência com liquidez diária e baixa volatilidade." },
  { titulo:"CDB Liquidez Diária", risco:"Baixo", horizonte:"Curto a médio", desc:"Rende próximo ao CDI, indicado para caixa e objetivos táticos." },
  { titulo:"Tesouro IPCA", risco:"Médio", horizonte:"Médio a longo", desc:"Protege contra inflação com taxa real. Ideal para objetivos de longo prazo." },
  { titulo:"ETFs de Ações Brasil", risco:"Médio/Alto", horizonte:"Longo prazo", desc:"Diversificação com taxa baixa. Expectativa de retorno superior no longo prazo." },
  { titulo:"Fundos Imobiliários (FIIs)", risco:"Médio", horizonte:"Médio/Longo", desc:"Renda mensal com isenção para pessoa física em muitos casos." }
];

export function formatCurrencyBRL(v) {
  return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}

export function jurosCompostos(P, aporteMensal, taxaMensal, meses) {
  // FV = P*(1+i)^n + A*(((1+i)^n - 1)/i)
  const n = meses;
  const i = taxaMensal;
  const principal = P * Math.pow(1+i, n);
  const serie = i === 0 ? aporteMensal * n : aporteMensal * ((Math.pow(1+i, n) - 1) / i);
  return principal + serie;
}
/* ...existing code... */

