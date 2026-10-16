require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURAÇÃO — Groq IA
// ============================================
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// ============================================
// GERADOR DE DADOS SIMULADOS
// ============================================

const PLANTAS = [
  { id: 1, nome: 'Planta São Paulo',    local: 'São Paulo, SP',   ativa: true,  area: 'Manufatura' },
  { id: 2, nome: 'Planta Curitiba',     local: 'Curitiba, PR',    ativa: true,  area: 'Montagem'   },
  { id: 3, nome: 'Planta Porto Alegre', local: 'Porto Alegre, RS', ativa: true,  area: 'Usinagem'   },
  { id: 4, nome: 'Planta Manaus',       local: 'Manaus, AM',      ativa: false, area: 'Eletrônica' },
];

const TIPOS_EQUIPAMENTO = [
  'Compressor Industrial',
  'Bomba Hidráulica',
  'Esteira Transportadora',
  'Máquina CNC',
  'Prensa Hidráulica',
  'Torno Mecânico',
  'Forno Industrial',
  'Robô de Soldagem',
  'Motor Elétrico',
  'Gerador',
];

const SETORES = ['Linha A', 'Linha B', 'Linha C', 'Utilidades', 'Manutenção', 'Qualidade'];

// Gera lista de equipamentos simulados com seed fixo (mesmo resultado sempre)
function gerarEquipamentos() {
  const equips = [];
  let id = 1;
  for (const planta of PLANTAS) {
    for (let i = 0; i < 8; i++) {
      const tipo = TIPOS_EQUIPAMENTO[id % TIPOS_EQUIPAMENTO.length];
      const setor = SETORES[i % SETORES.length];
      equips.push({
        id,
        plantaId: planta.id,
        plantaNome: planta.nome,
        setor,
        tipo,
        nome: `${tipo} ${setor}-${String(id).padStart(3, '0')}`,
        tag: `EQ-${planta.id}${String(id).padStart(4, '0')}`,
        fabricante: ['Siemens', 'ABB', 'WEG', 'Atlas Copco', 'Parker'][id % 5],
        anoInstalacao: 2015 + (id % 9),
        statusOperacional: planta.ativa ? (['operando', 'operando', 'operando', 'manutencao', 'alerta'][id % 5]) : 'parado',
        horasOperacao: 1000 + (id * 317) % 40000,
        proximaManutencao: new Date(Date.now() + ((id * 7) % 90) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      id++;
    }
  }
  return equips;
}

const EQUIPAMENTOS = gerarEquipamentos();

// Gera leitura de sensor com variação baseada no tempo
function gerarLeitura(equipId, tipo, offsetMin = 0) {
  const base = {
    'Compressor Industrial': { temp: 75, vibracao: 2.5, pressao: 8.5, corrente: 45 },
    'Bomba Hidráulica':      { temp: 65, vibracao: 1.8, pressao: 12.0, corrente: 30 },
    'Esteira Transportadora':{ temp: 55, vibracao: 3.2, pressao: 0,    corrente: 22 },
    'Máquina CNC':           { temp: 60, vibracao: 0.8, pressao: 5.5,  corrente: 18 },
    'Prensa Hidráulica':     { temp: 70, vibracao: 4.1, pressao: 20.0, corrente: 55 },
    'Torno Mecânico':        { temp: 58, vibracao: 1.5, pressao: 3.2,  corrente: 15 },
    'Forno Industrial':      { temp: 350, vibracao: 0.5, pressao: 1.2, corrente: 80 },
    'Robô de Soldagem':      { temp: 90, vibracao: 2.0, pressao: 6.0,  corrente: 40 },
    'Motor Elétrico':        { temp: 68, vibracao: 1.2, pressao: 0,    corrente: 35 },
    'Gerador':               { temp: 82, vibracao: 2.8, pressao: 4.5,  corrente: 60 },
  };
  const b = base[tipo] || base['Motor Elétrico'];
  const seed = (equipId * 31 + offsetMin * 7) % 100;
  const ruido = (v) => v + (seed % 20 - 10) * v * 0.02;
  return {
    timestamp: new Date(Date.now() - offsetMin * 60000).toISOString(),
    temperatura: +ruido(b.temp).toFixed(1),
    vibracao:    +ruido(b.vibracao).toFixed(2),
    pressao:     b.pressao > 0 ? +ruido(b.pressao).toFixed(1) : 0,
    corrente:    +ruido(b.corrente).toFixed(1),
    rpm:         tipo.includes('Motor') || tipo.includes('Compressor') ? Math.round(1450 + seed * 5) : null,
    eficiencia:  +(85 + seed % 12).toFixed(1),
  };
}

// Gera falhas simuladas
function gerarFalhas() {
  const DESC_FALHA = [
    { desc: 'Temperatura acima do limite crítico', crit: 'C' },
    { desc: 'Vibração excessiva detectada',        crit: 'C' },
    { desc: 'Pressão fora da faixa operacional',   crit: 'A' },
    { desc: 'Corrente elétrica elevada',            crit: 'A' },
    { desc: 'Temperatura em zona de atenção',       crit: 'M' },
    { desc: 'Vibração acima do recomendado',        crit: 'M' },
    { desc: 'Eficiência abaixo de 85%',             crit: 'M' },
    { desc: 'Pressão em zona de alerta',            crit: 'A' },
  ];

  const falhas = [];
  let id = 1;
  for (const eq of EQUIPAMENTOS.slice(0, 20)) {
    if (id % 3 === 0) {
      const f = DESC_FALHA[id % DESC_FALHA.length];
      const mins = (id * 47) % 300;
      const horas = Math.floor(mins / 60);
      const resto = mins % 60;
      falhas.push({
        id,
        equipamentoId: eq.id,
        equipamentoNome: eq.nome,
        equipamentoTag: eq.tag,
        plantaId: eq.plantaId,
        plantaNome: eq.plantaNome,
        setor: eq.setor,
        tipo: eq.tipo,
        descricao: f.desc,
        criticidade: f.crit,
        ativa: true,
        detectadaEm: new Date(Date.now() - mins * 60000).toISOString(),
        tempo: horas > 0 ? `${horas}h ${resto}min` : `${resto}min`,
        tecnico: ['João Silva', 'Maria Santos', null, null][id % 4],
        observacao: id % 5 === 0 ? 'Técnico acionado, aguardando peça de reposição' : null,
      });
    }
    id++;
  }
  return falhas;
}

// ============================================
// ENDPOINTS — Plantas industriais
// ============================================
app.get('/api/plantas', (req, res) => {
  res.json(PLANTAS);
});

app.get('/api/plantas/:id', (req, res) => {
  const planta = PLANTAS.find(p => p.id === parseInt(req.params.id));
  if (!planta) return res.status(404).json({ erro: 'Planta não encontrada' });
  res.json(planta);
});

// ============================================
// ENDPOINTS — Equipamentos
// ============================================
app.get('/api/equipamentos', (req, res) => {
  const { planta_id, setor, status } = req.query;
  let result = [...EQUIPAMENTOS];
  if (planta_id) result = result.filter(e => String(e.plantaId) === String(planta_id));
  if (setor)     result = result.filter(e => e.setor === setor);
  if (status)    result = result.filter(e => e.statusOperacional === status);
  res.json(result);
});

app.get('/api/equipamentos/:id', (req, res) => {
  const eq = EQUIPAMENTOS.find(e => e.id === parseInt(req.params.id));
  if (!eq) return res.status(404).json({ erro: 'Equipamento não encontrado' });
  res.json(eq);
});

// ============================================
// ENDPOINTS — Telemetria (sensores simulados)
// ============================================
app.get('/api/telemetria/:equipId', (req, res) => {
  const eq = EQUIPAMENTOS.find(e => e.id === parseInt(req.params.equipId));
  if (!eq) return res.status(404).json({ erro: 'Equipamento não encontrado' });

  const pontos = 48; // últimas 48 horas (1 leitura/hora)
  const historico = [];
  for (let i = pontos; i >= 0; i--) {
    historico.push(gerarLeitura(eq.id, eq.tipo, i * 60));
  }

  // Formatar como datasets para gráfico (igual FrioSmart)
  const campos = ['temperatura', 'vibracao', 'pressao', 'corrente', 'eficiencia'];
  const labels = ['Temperatura (°C)', 'Vibração (mm/s)', 'Pressão (bar)', 'Corrente (A)', 'Eficiência (%)'];
  const cores  = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

  const datasets = campos.map((campo, idx) => ({
    label: labels[idx],
    data: historico.map(h => ({
      x: h.timestamp,
      y: h[campo],
    })),
    color: cores[idx],
  })).filter(d => d.data.some(p => p.y !== 0 && p.y !== null));

  res.json({
    equipamento: eq,
    datasets,
    ultima_leitura: gerarLeitura(eq.id, eq.tipo, 0),
  });
});

// ============================================
// ENDPOINTS — Falhas / Alertas
// ============================================
let FALHAS = gerarFalhas();

app.get('/api/falhas', (req, res) => {
  const { planta_id, criticidade, ativa } = req.query;
  let result = [...FALHAS];
  if (planta_id)   result = result.filter(f => String(f.plantaId) === String(planta_id));
  if (criticidade === 'critico')  result = result.filter(f => f.criticidade === 'C');
  if (criticidade === 'alto')     result = result.filter(f => f.criticidade === 'A');
  if (criticidade === 'medio')    result = result.filter(f => f.criticidade === 'M');
  if (ativa !== undefined)        result = result.filter(f => f.ativa === (ativa === 'true'));
  res.json(result);
});

app.patch('/api/falhas/:id/resolver', (req, res) => {
  const idx = FALHAS.findIndex(f => f.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ erro: 'Falha não encontrada' });
  FALHAS[idx] = { ...FALHAS[idx], ativa: false, resolvidaEm: new Date().toISOString(), ...req.body };
  res.json(FALHAS[idx]);
});

// ============================================
// ENDPOINTS — Dashboard
// ============================================
app.get('/api/dashboard', (req, res) => {
  const { planta_id } = req.query;
  let falhas = [...FALHAS];
  let equips = [...EQUIPAMENTOS];
  if (planta_id) {
    falhas = falhas.filter(f => String(f.plantaId) === String(planta_id));
    equips = equips.filter(e => String(e.plantaId) === String(planta_id));
  }

  const ativas = falhas.filter(f => f.ativa);
  const criticos = ativas.filter(f => f.criticidade === 'C').length;
  const altos    = ativas.filter(f => f.criticidade === 'A').length;
  const medios   = ativas.filter(f => f.criticidade === 'M').length;

  const porTipo = {};
  ativas.forEach(f => {
    const k = f.tipo;
    if (!porTipo[k]) porTipo[k] = { tipo: k, criticos: 0, altos: 0, medios: 0, total: 0 };
    porTipo[k].total++;
    if (f.criticidade === 'C') porTipo[k].criticos++;
    if (f.criticidade === 'A') porTipo[k].altos++;
    if (f.criticidade === 'M') porTipo[k].medios++;
  });

  res.json({
    falhas: { ativas: ativas.length, criticos, altos, medios },
    equipamentos: {
      total: equips.length,
      operando:   equips.filter(e => e.statusOperacional === 'operando').length,
      manutencao: equips.filter(e => e.statusOperacional === 'manutencao').length,
      alerta:     equips.filter(e => e.statusOperacional === 'alerta').length,
      parado:     equips.filter(e => e.statusOperacional === 'parado').length,
    },
    plantas: {
      total:  PLANTAS.length,
      ativas: PLANTAS.filter(p => p.ativa).length,
    },
    porTipo: Object.values(porTipo).sort((a, b) => b.criticos - a.criticos),
    ultimas_falhas: ativas.slice(0, 15),
  });
});

// ============================================
// ENDPOINTS — Ordens de Serviço
// ============================================
const ordensServico = [];

app.get('/api/ordens', (req, res) => {
  const { planta_id, status } = req.query;
  let result = [...ordensServico];
  if (planta_id) result = result.filter(o => String(o.plantaId) === String(planta_id));
  if (status)    result = result.filter(o => o.status === status);
  res.json(result);
});

app.post('/api/ordens', (req, res) => {
  const eq = EQUIPAMENTOS.find(e => e.id === parseInt(req.body.equipamentoId));
  const nova = {
    id: Date.now(),
    ...req.body,
    plantaId:   eq?.plantaId,
    plantaNome: eq?.plantaNome,
    status: 'aberta',
    criadaEm: new Date().toISOString(),
  };
  ordensServico.unshift(nova);
  res.json(nova);
});

app.patch('/api/ordens/:id', (req, res) => {
  const idx = ordensServico.findIndex(o => String(o.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Ordem não encontrada' });
  ordensServico[idx] = { ...ordensServico[idx], ...req.body, atualizadaEm: new Date().toISOString() };
  res.json(ordensServico[idx]);
});

// ============================================
// FUNÇÃO COMPARTILHADA — Diagnóstico IA
// ============================================
/**
 * [IA] Envia falha industrial para o modelo Groq llama-3.3-70b-versatile.
 * Retorna JSON com campos: diagnostico, recomendacao, urgencia.
 * Documentado conforme requisito do trabalho acadêmico.
 */
async function gerarDiagnostico(falha) {
  // Fallback sem IA configurada
  if (!groq) {
    return {
      diagnostico: `Falha "${falha.descricao}" detectada no equipamento ${falha.equipamentoNome} (${falha.equipamentoTag}). Ativo há ${falha.tempo}.`,
      recomendacao: 'Configure GROQ_API_KEY no arquivo .env para diagnóstico automático com IA.',
      urgencia: falha.criticidade === 'C' ? 'critica' : falha.criticidade === 'A' ? 'alta' : 'media',
    };
  }

  // [IA] Chamada ao modelo LLM via Groq SDK
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        // [IA] Prompt de sistema: define o perfil do especialista
        content: 'Você é especialista em manutenção de sistemas industriais com 20 anos de experiência. Responda SEMPRE apenas com JSON válido, sem texto adicional, sem markdown.',
      },
      {
        role: 'user',
        // [IA] Prompt de usuário: estrutura os dados da falha para análise
        content: `Analise esta falha de equipamento industrial:

Planta: ${falha.plantaNome}
Setor: ${falha.setor}
Equipamento: ${falha.equipamentoNome} (${falha.equipamentoTag})
Tipo: ${falha.tipo}
Falha: ${falha.descricao}
Criticidade: ${falha.criticidade === 'C' ? 'Crítica' : falha.criticidade === 'A' ? 'Alta' : 'Média'}
Tempo ativo: ${falha.tempo}
Técnico responsável: ${falha.tecnico || 'não atribuído'}
Observação: ${falha.observacao || 'nenhuma'}

Responda APENAS com este JSON:
{"diagnostico":"causa provável em 2-3 frases técnicas","recomendacao":"ações corretivas em 3-4 passos numerados","urgencia":"critica|alta|media|baixa"}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const texto = completion.choices[0].message.content.trim();
  // [IA] Parse do JSON retornado pelo modelo
  // [IA] Parse robusto — extrai JSON mesmo se o modelo truncar a resposta
  let limpo = texto.replace(/```json|```/g, '').trim();
  // Tenta extrair só o objeto JSON da resposta
  const match = limpo.match(/\{[\s\S]*\}/);
  if (match) limpo = match[0];
  // Se o JSON estiver incompleto, fecha as chaves abertas
  try {
    return JSON.parse(limpo);
  } catch {
    // Completa JSON truncado adicionando fechamentos necessários
    let abertos = (limpo.match(/\{/g) || []).length - (limpo.match(/\}/g) || []).length;
    // Fecha string aberta se necessário
    if ((limpo.match(/"/g) || []).length % 2 !== 0) limpo += '"';
    limpo += '}'.repeat(Math.max(abertos, 1));
    try {
      return JSON.parse(limpo);
    } catch {
      // Fallback manual extraindo campos com regex
      const diag = limpo.match(/"diagnostico"\s*:\s*"([^"]+)"/)?.[1] || 'Análise indisponível';
      const rec  = limpo.match(/"recomendacao"\s*:\s*"([^"]+)"/)?.[1] || 'Consulte um técnico especializado';
      const urg  = limpo.match(/"urgencia"\s*:\s*"([^"]+)"/)?.[1] || 'alta';
      return { diagnostico: diag, recomendacao: rec, urgencia: urg };
    }
  }
}

app.post('/api/ia/diagnostico', async (req, res) => {
  const { falha } = req.body;
  if (!falha) return res.status(400).json({ erro: 'Falha não informada' });
  try {
    const resultado = await gerarDiagnostico(falha);
    res.json(resultado);
  } catch (e) {
    console.error('[IA] Erro diagnóstico:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ============================================
// FUNÇÃO COMPARTILHADA — Enviar WhatsApp
// ============================================
/**
 * [WhatsApp] Envia alerta via CallMeBot API (serviço gratuito).
 * Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
async function enviarWhatsApp(falha, diagnostico) {
  const numero = process.env.WHATSAPP_NUMERO;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!numero || !apikey) throw new Error('WhatsApp não configurado no .env');

  const mensagem =
`🏭 ALERTA INDUSTRIATECH

🏗️ Planta: ${falha.plantaNome}
📍 Setor: ${falha.setor}
⚙️ Equipamento: ${falha.equipamentoNome}
🏷️ TAG: ${falha.equipamentoTag}
⚠️ Falha: ${falha.descricao}
⏱️ Ativo há: ${falha.tempo}

🤖 Diagnóstico IA:
${diagnostico?.diagnostico || 'Não disponível'}

✅ Recomendação:
${diagnostico?.recomendacao || 'Não disponível'}`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encodeURIComponent(mensagem)}&apikey=${apikey}`;
  await axios.get(url, { timeout: 15000 });
}

app.post('/api/whatsapp/notificar', async (req, res) => {
  const { falha, diagnostico } = req.body;
  if (!falha) return res.status(400).json({ ok: false, erro: 'Falha não informada' });
  try {
    await enviarWhatsApp(falha, diagnostico);
    res.json({ ok: true });
  } catch (e) {
    console.error('[WhatsApp] Erro:', e.message);
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ============================================
// ROTINA AUTOMÁTICA — Bot de monitoramento
// ============================================
/**
 * [BOT] Verifica falhas Críticas e Altas a cada 5 minutos.
 * Para cada nova falha (não notificada anteriormente):
 *   1. Gera diagnóstico com IA (Groq)
 *   2. Envia alerta via WhatsApp (CallMeBot)
 *   3. Registra ID no Set para evitar duplicatas
 */
const INTERVALO_MS = 5 * 60 * 1000;
const falhasNotificadas = new Set();
let rotinaAtiva = !!(process.env.WHATSAPP_NUMERO && process.env.CALLMEBOT_APIKEY);
let ultimaVerificacao = null;
let totalNotificadosSessao = 0;

async function verificarENotificar() {
  if (!rotinaAtiva) return;
  try {
    const relevantes = FALHAS.filter(f => f.ativa && (f.criticidade === 'C' || f.criticidade === 'A'));

    for (const falha of relevantes) {
      const chave = String(falha.id);
      if (falhasNotificadas.has(chave)) continue;

      try {
        const diagnostico = await gerarDiagnostico(falha);
        await enviarWhatsApp(falha, diagnostico);
        falhasNotificadas.add(chave);
        totalNotificadosSessao++;
        console.log(`[BOT] ✅ Notificado: ${falha.plantaNome} · ${falha.equipamentoNome} (${falha.descricao})`);
      } catch (e) {
        console.error(`[BOT] ❌ Erro ao notificar falha ${chave}:`, e.message);
      }

      // Pausa entre notificações para não sobrecarregar IA/WhatsApp
      await new Promise(r => setTimeout(r, 2000));
    }

    ultimaVerificacao = new Date();
    console.log(`[BOT] Verificação OK — ${relevantes.length} falhas relevantes, ${falhasNotificadas.size} já notificadas`);
  } catch (e) {
    console.error('[BOT] Erro na verificação automática:', e.message);
  }
}

// Controle do bot pelo frontend
app.get('/api/bot/status', (req, res) => {
  res.json({
    ativo: rotinaAtiva,
    intervalo_minutos: INTERVALO_MS / 60000,
    ultima_verificacao: ultimaVerificacao,
    total_notificados_sessao: totalNotificadosSessao,
    falhas_notificadas_ids: falhasNotificadas.size,
    whatsapp_configurado: !!(process.env.WHATSAPP_NUMERO && process.env.CALLMEBOT_APIKEY),
  });
});

app.post('/api/bot/toggle', (req, res) => {
  if (!process.env.WHATSAPP_NUMERO || !process.env.CALLMEBOT_APIKEY) {
    return res.status(400).json({ erro: 'Configure WHATSAPP_NUMERO e CALLMEBOT_APIKEY no .env primeiro' });
  }
  rotinaAtiva = !rotinaAtiva;
  console.log(`[BOT] ${rotinaAtiva ? '▶️ Ativado' : '⏸️ Pausado'} pelo usuário`);
  res.json({ ativo: rotinaAtiva });
});

app.post('/api/bot/verificar-agora', async (req, res) => {
  await verificarENotificar();
  res.json({ ok: true, ultima_verificacao: ultimaVerificacao });
});

// ============================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================
app.listen(3001, () => {
  console.log('✅ IndustriaTech API rodando em http://localhost:3001');
  console.log(`📊 ${EQUIPAMENTOS.length} equipamentos simulados carregados`);
  console.log(`⚠️  ${FALHAS.filter(f => f.ativa).length} falhas ativas simuladas`);

  if (rotinaAtiva) {
    console.log('🤖 Bot de monitoramento ATIVO — verificando falhas Críticas+Altas a cada 5 minutos');
    verificarENotificar();
    setInterval(verificarENotificar, INTERVALO_MS);
  } else {
    console.log('🤖 Bot INATIVO — configure WHATSAPP_NUMERO e CALLMEBOT_APIKEY no .env para ativar');
  }
});
