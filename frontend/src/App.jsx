import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar,
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ============================================
// UTILITÁRIOS
// ============================================
const CRIT_CLS   = { C: "badge-danger", A: "badge-warning", M: "badge-info" };
const CRIT_LABEL = { C: "Crítico",      A: "Alto",          M: "Médio"      };
const STATUS_CLS = {
  operando:   "badge-success",
  manutencao: "badge-info",
  alerta:     "badge-warning",
  parado:     "badge-danger",
};

function Badge({ type, text, cls }) {
  return <span className={`badge ${cls || ""}`}>{text}</span>;
}

const CRIT_STYLE = {
  C: { background: "rgba(239,68,68,0.2)",   color: "#fca5a5", border: "1px solid rgba(239,68,68,0.5)" },
  A: { background: "rgba(245,158,11,0.2)",  color: "#fcd34d", border: "1px solid rgba(245,158,11,0.5)" },
  M: { background: "rgba(59,130,246,0.25)", color: "#bfdbfe", border: "1px solid rgba(59,130,246,0.7)", boxShadow: "0 0 8px rgba(59,130,246,0.3)" },
};

function CritBadge({ crit }) {
  const st = CRIT_STYLE[crit] || CRIT_STYLE.M;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: "20px",
      fontSize: "10px", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.5px",
      whiteSpace: "nowrap", ...st
    }}>
      {CRIT_LABEL[crit] || crit}
    </span>
  );
}

function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_CLS[status] || "badge-info"}`}>{status}</span>;
}

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Carregando...</span></div>;
}

function useFetch(url) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(() => {
    if (!url) return;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [url]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ============================================
// NAV
// ============================================
const PAGES = [
  { id: "dashboard",   label: "Dashboard",       icon: "📊" },
  { id: "plantas",     label: "Plantas",          icon: "🏭" },
  { id: "equipamentos",label: "Equipamentos",     icon: "⚙️" },
  { id: "falhas",      label: "Falhas",           icon: "⚠️" },
  { id: "telemetria",  label: "Telemetria",       icon: "📈" },
  { id: "ordens",      label: "Ordens de Serviço",icon: "🔧" },
  { id: "ia",          label: "Diagnóstico IA",   icon: "🤖" },
];

function Nav({ page, setPage, alertas }) {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <span className="nav-logo">🏭</span>
        <div>
          <div className="nav-title">IndustriaTech</div>
          <div className="nav-sub">Manutenção Industrial</div>
        </div>
      </div>
      <div className="nav-links">
        {PAGES.map(p => (
          <button
            key={p.id}
            className={`nav-link${page === p.id ? " active" : ""}`}
            onClick={() => setPage(p.id)}
          >
            <span className="nav-icon">{p.icon}</span>
            <span className="nav-label">{p.label}</span>
            {p.id === "falhas" && alertas > 0 && (
              <span className="nav-badge">{alertas}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ============================================
// PAINEL BOT
// ============================================
function PainelBot() {
  const [status, setStatus] = useState(null);
  const [toggling, setToggling] = useState(false);

  const carregarStatus = () => {
    fetch(`${API}/api/bot/status`).then(r => r.json()).then(setStatus).catch(() => {});
  };

  useEffect(() => { carregarStatus(); const t = setInterval(carregarStatus, 15000); return () => clearInterval(t); }, []);

  const toggle = async () => {
    setToggling(true);
    try {
      const r = await fetch(`${API}/api/bot/toggle`, { method: "POST" });
      const d = await r.json();
      if (d.erro) alert("⚠️ " + d.erro);
      else carregarStatus();
    } catch (e) { alert("Erro: " + e.message); }
    setToggling(false);
  };

  const verificarAgora = async () => {
    try {
      await fetch(`${API}/api/bot/verificar-agora`, { method: "POST" });
      carregarStatus();
    } catch (e) { alert("Erro: " + e.message); }
  };

  if (!status) return null;
  return (
    <div className={`card bot-panel ${status.ativo ? "bot-ativo" : "bot-inativo"}`}>
      <div className="bot-header">
        <div className="bot-status-dot" style={{ background: status.ativo ? "var(--success)" : "var(--text-3)" }} />
        <span className="bot-title">Bot de Monitoramento</span>
        <span className="bot-badge">{status.ativo ? "ATIVO" : "INATIVO"}</span>
      </div>
      <div className="bot-info">
        <span>🔔 {status.total_notificados_sessao} notif. enviadas</span>
        <span>⏱️ A cada {status.intervalo_minutos} min</span>
        {status.ultima_verificacao && (
          <span>🕐 {new Date(status.ultima_verificacao).toLocaleTimeString("pt-BR")}</span>
        )}
      </div>
      <div className="bot-actions">
        <button className={`btn-sm ${status.ativo ? "btn-warning" : "btn-success"}`} onClick={toggle} disabled={toggling}>
          {status.ativo ? "⏸ Pausar" : "▶ Ativar"}
        </button>
        <button className="btn-sm btn-secondary" onClick={verificarAgora}>🔍 Verificar agora</button>
      </div>
      {!status.whatsapp_configurado && (
        <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 6 }}>
          ⚠️ Configure WHATSAPP_NUMERO e CALLMEBOT_APIKEY no .env para ativar
        </div>
      )}
    </div>
  );
}

// ============================================
// DASHBOARD
// ============================================
function PageDashboard({ plantaId }) {
  const { data, loading } = useFetch(`${API}/api/dashboard${plantaId ? `?planta_id=${plantaId}` : ""}`);

  if (loading) return <Loading />;
  if (!data) return null;

  const { falhas, equipamentos, plantas, porTipo, ultimas_falhas } = data;

  return (
    <div className="page">
      <PainelBot />

      <div className="kpi-grid">
        <div className="kpi-card kpi-danger">
          <div className="kpi-value">{falhas.criticos}</div>
          <div className="kpi-label">Falhas Críticas</div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-value">{falhas.altos}</div>
          <div className="kpi-label">Falhas Altas</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-value">{falhas.medios}</div>
          <div className="kpi-label">Falhas Médias</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-value">{equipamentos.operando}</div>
          <div className="kpi-label">Equipamentos OK</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{equipamentos.manutencao}</div>
          <div className="kpi-label">Em Manutenção</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{plantas.ativas}/{plantas.total}</div>
          <div className="kpi-label">Plantas Ativas</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><span className="card-title-icon">📊</span> Falhas por Tipo de Equipamento</div>
          {porTipo.length === 0 ? (
            <div className="empty">Nenhuma falha ativa</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porTipo} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
                <XAxis dataKey="tipo" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ background: "#1e2534", border: "1px solid #2a3142", borderRadius: 8, color: "#e2e8f0" }} />
                <Bar dataKey="criticos" name="Críticos" fill="#ef4444" radius={[3,3,0,0]} />
                <Bar dataKey="altos"    name="Altos"    fill="#f59e0b" radius={[3,3,0,0]} />
                <Bar dataKey="medios"   name="Médios"   fill="#3b82f6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-title"><span className="card-title-icon">⚠️</span> Últimas Falhas</div>
          <div className="lista-falhas">
            {ultimas_falhas.slice(0, 8).map(f => (
              <div key={f.id} className="falha-item">
                <CritBadge crit={f.criticidade} />
                <div className="falha-info">
                  <div className="falha-nome">{f.equipamentoNome}</div>
                  <div className="falha-desc">{f.descricao}</div>
                </div>
                <div className="falha-tempo">{f.tempo}</div>
              </div>
            ))}
            {ultimas_falhas.length === 0 && <div className="empty">Nenhuma falha ativa 🎉</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PLANTAS
// ============================================
function PagePlantas({ setPlantaId }) {
  const { data: plantas, loading } = useFetch(`${API}/api/plantas`);
  const { data: dash } = useFetch(`${API}/api/dashboard`);

  if (loading) return <Loading />;

  return (
    <div className="page">
      <div className="cards-grid">
        {(plantas || []).map(p => {
          const info = dash?.porTipo;
          return (
            <div key={p.id} className={`card planta-card ${!p.ativa ? "planta-inativa" : ""}`}>
              <div className="planta-header">
                <div className="planta-icon">🏭</div>
                <div>
                  <div className="planta-nome">{p.nome}</div>
                  <div className="planta-local">📍 {p.local}</div>
                </div>
                <span className={`badge ${p.ativa ? "badge-success" : "badge-danger"}`}>
                  {p.ativa ? "Ativa" : "Inativa"}
                </span>
              </div>
              <div className="planta-area">Área: {p.area}</div>
              <div className="planta-actions">
                <button className="btn-sm btn-secondary" onClick={() => setPlantaId(String(p.id))}>
                  🔍 Filtrar por esta planta
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// EQUIPAMENTOS
// ============================================
function PageEquipamentos({ plantaId }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const { data: equips, loading } = useFetch(
    `${API}/api/equipamentos${plantaId ? `?planta_id=${plantaId}` : ""}`
  );

  if (loading) return <Loading />;

  const lista = (equips || []).filter(e => {
    const ok = !busca || e.nome.toLowerCase().includes(busca.toLowerCase()) ||
               e.tag.toLowerCase().includes(busca.toLowerCase()) ||
               e.tipo.toLowerCase().includes(busca.toLowerCase());
    const okStatus = !statusFiltro || e.statusOperacional === statusFiltro;
    return ok && okStatus;
  });

  return (
    <div className="page">
      <div className="filtros-bar">
        <input
          className="input search-input"
          placeholder="🔍 Buscar equipamento, TAG ou tipo..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className="input select-small" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="operando">Operando</option>
          <option value="manutencao">Em manutenção</option>
          <option value="alerta">Alerta</option>
          <option value="parado">Parado</option>
        </select>
      </div>

      <div className="card">
        <div className="card-title">
          <span className="card-title-icon">⚙️</span> Equipamentos ({lista.length})
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>TAG</th>
                <th>Equipamento</th>
                <th>Tipo</th>
                <th>Planta</th>
                <th>Setor</th>
                <th>Status</th>
                <th>Horas Op.</th>
                <th>Próx. Manutenção</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(e => (
                <tr key={e.id}>
                  <td><span className="tag-code">{e.tag}</span></td>
                  <td>{e.nome}</td>
                  <td style={{ color: "var(--text-2)", fontSize: 12 }}>{e.tipo}</td>
                  <td style={{ fontSize: 12 }}>{e.plantaNome}</td>
                  <td style={{ fontSize: 12 }}>{e.setor}</td>
                  <td><StatusBadge status={e.statusOperacional} /></td>
                  <td>{e.horasOperacao.toLocaleString()} h</td>
                  <td style={{ fontSize: 12 }}>{e.proximaManutencao}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <div className="empty">Nenhum equipamento encontrado</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FALHAS
// ============================================
function PageFalhas({ plantaId }) {
  const [filtro, setFiltro] = useState("");
  const { data: falhas, loading, reload } = useFetch(
    `${API}/api/falhas${plantaId ? `?planta_id=${plantaId}` : ""}`
  );

  if (loading) return <Loading />;

  const lista = (falhas || []).filter(f => {
    if (!filtro) return true;
    if (filtro === "C") return f.criticidade === "C";
    if (filtro === "A") return f.criticidade === "A";
    if (filtro === "M") return f.criticidade === "M";
    if (filtro === "resolvidas") return !f.ativa;
    return f.ativa;
  });

  const resolver = async (id) => {
    const tecnico = prompt("Nome do técnico responsável:");
    if (!tecnico) return;
    await fetch(`${API}/api/falhas/${id}/resolver`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tecnico }),
    });
    reload();
  };

  return (
    <div className="page">
      <div className="filtros-bar">
        {[
          { val: "", label: "Todas" },
          { val: "C", label: "🔴 Críticas" },
          { val: "A", label: "🟡 Altas" },
          { val: "M", label: "🔵 Médias" },
          { val: "resolvidas", label: "✅ Resolvidas" },
        ].map(f => (
          <button
            key={f.val}
            className={`btn-filter ${filtro === f.val ? "active" : ""}`}
            onClick={() => setFiltro(f.val)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          <span className="card-title-icon">⚠️</span> Falhas ({lista.length})
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Crit.</th>
                <th>Equipamento</th>
                <th>TAG</th>
                <th>Planta / Setor</th>
                <th>Falha</th>
                <th>Tempo</th>
                <th>Técnico</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(f => (
                <tr key={f.id} className={!f.ativa ? "row-resolved" : ""}>
                  <td><CritBadge crit={f.criticidade} /></td>
                  <td>{f.equipamentoNome}</td>
                  <td><span className="tag-code">{f.equipamentoTag}</span></td>
                  <td style={{ fontSize: 12 }}>{f.plantaNome}<br /><span style={{ color: "var(--text-3)" }}>{f.setor}</span></td>
                  <td style={{ fontSize: 12 }}>{f.descricao}</td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{f.tempo}</td>
                  <td style={{ fontSize: 12 }}>{f.tecnico || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                  <td>
                    {f.ativa ? (
                      <button className="btn-sm btn-success" onClick={() => resolver(f.id)}>✅ Resolver</button>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--success)" }}>Resolvida</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <div className="empty">Nenhuma falha encontrada 🎉</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TELEMETRIA
// ============================================
function PageTelemetria({ plantaId }) {
  const { data: equips } = useFetch(`${API}/api/equipamentos${plantaId ? `?planta_id=${plantaId}` : ""}`);
  const [equipId, setEquipId] = useState("");
  const [tele, setTele]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [selecionados, setSelecionados] = useState([]);

  const carregarTelemetria = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/telemetria/${id}`);
      const d = await r.json();
      setTele(d);
      setSelecionados(d.datasets?.map(ds => ds.label) || []);
    } catch (e) {
      console.error("Erro telemetria:", e.message);
    }
    setLoading(false);
  };

  useEffect(() => { if (equipId) carregarTelemetria(equipId); }, [equipId]);

  const datasets = tele?.datasets || [];
  const visíveis = datasets.filter(ds => selecionados.includes(ds.label));

  // Montar dados para o gráfico
  const chartData = (() => {
    if (!visíveis.length) return [];
    const map = {};
    visíveis.forEach(ds => {
      ds.data.forEach(pt => {
        const hora = new Date(pt.x).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (!map[hora]) map[hora] = { hora };
        map[hora][ds.label] = pt.y;
      });
    });
    return Object.values(map);
  })();

  const CORES = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

  return (
    <div className="page">
      <div className="card">
        <div className="card-title"><span className="card-title-icon">📈</span> Telemetria de Sensores</div>
        <select className="input" value={equipId} onChange={e => setEquipId(e.target.value)}>
          <option value="">Selecione um equipamento...</option>
          {(equips || []).map(e => (
            <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>
          ))}
        </select>
      </div>

      {loading && <Loading />}

      {tele && !loading && (
        <>
          {/* Última leitura */}
          <div className="card">
            <div className="card-title"><span className="card-title-icon">⚡</span> Leitura Atual — {tele.equipamento?.nome}</div>
            <div className="leitura-grid">
              {Object.entries(tele.ultima_leitura || {})
                .filter(([k]) => k !== "timestamp" && tele.ultima_leitura[k] !== null && tele.ultima_leitura[k] !== 0)
                .map(([k, v]) => (
                  <div key={k} className="leitura-card">
                    <div className="leitura-valor">{typeof v === "number" ? v.toFixed(1) : v}</div>
                    <div className="leitura-label">
                      {k === "temperatura" ? "Temperatura (°C)" :
                       k === "vibracao"    ? "Vibração (mm/s)" :
                       k === "pressao"     ? "Pressão (bar)"   :
                       k === "corrente"    ? "Corrente (A)"    :
                       k === "rpm"         ? "RPM"             :
                       k === "eficiencia"  ? "Eficiência (%)"  : k}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Seleção de sensores */}
          <div className="card">
            <div className="card-title"><span className="card-title-icon">🔘</span> Sensores Visíveis</div>
            <div className="sensor-toggle-row">
              {datasets.map((ds, i) => (
                <button
                  key={ds.label}
                  className={`sensor-btn ${selecionados.includes(ds.label) ? "active" : ""}`}
                  style={{ "--sensor-color": CORES[i % CORES.length] }}
                  onClick={() => setSelecionados(prev =>
                    prev.includes(ds.label) ? prev.filter(l => l !== ds.label) : [...prev, ds.label]
                  )}
                >
                  <span className="sensor-dot" style={{ background: CORES[i % CORES.length] }} />
                  {ds.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gráfico */}
          <div className="card">
            <div className="card-title"><span className="card-title-icon">📉</span> Histórico 48h</div>
            {visíveis.length === 0 ? (
              <div className="empty">Selecione ao menos um sensor acima</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
                  <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={5} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ background: "#1e2534", border: "1px solid #2a3142", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {visíveis.map((ds, i) => (
                    <Line
                      key={ds.label}
                      type="monotone"
                      dataKey={ds.label}
                      stroke={CORES[i % CORES.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// ORDENS DE SERVIÇO
// ============================================
function PageOrdens({ plantaId }) {
  const { data: ordens, loading, reload } = useFetch(
    `${API}/api/ordens${plantaId ? `?planta_id=${plantaId}` : ""}`
  );
  const { data: equips } = useFetch(`${API}/api/equipamentos`);
  const [form, setForm] = useState({ equipamentoId: "", tipo: "preventiva", prioridade: "media", descricao: "", tecnico: "" });
  const [criando, setCriando] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const criarOrdem = async () => {
    if (!form.equipamentoId || !form.descricao) return alert("Preencha equipamento e descrição");
    setCriando(true);
    await fetch(`${API}/api/ordens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCriando(false);
    setShowForm(false);
    reload();
  };

  const STATUS_ORDEM = { aberta: "badge-info", em_andamento: "badge-warning", concluida: "badge-success", cancelada: "badge-danger" };

  const atualizarStatus = async (id, novoStatus) => {
    await fetch(`${API}/api/ordens/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    reload();
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "✕ Cancelar" : "+ Nova Ordem de Serviço"}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title"><span className="card-title-icon">🔧</span> Nova Ordem de Serviço</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Equipamento *</label>
              <select className="input" value={form.equipamentoId} onChange={e => setForm(f => ({ ...f, equipamentoId: e.target.value }))}>
                <option value="">Selecione...</option>
                {(equips || []).map(e => <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="preventiva">Preventiva</option>
                <option value="corretiva">Corretiva</option>
                <option value="preditiva">Preditiva</option>
                <option value="inspecao">Inspeção</option>
              </select>
            </div>
            <div className="form-group">
              <label>Prioridade</label>
              <select className="input" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
                <option value="critica">Crítica</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div className="form-group">
              <label>Técnico Responsável</label>
              <input className="input" value={form.tecnico} onChange={e => setForm(f => ({ ...f, tecnico: e.target.value }))} placeholder="Nome do técnico" />
            </div>
            <div className="form-group form-full">
              <label>Descrição do Serviço *</label>
              <textarea className="input" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o serviço a ser realizado..." />
            </div>
          </div>
          <button className="btn-primary" onClick={criarOrdem} disabled={criando}>{criando ? "Criando..." : "✅ Criar Ordem"}</button>
        </div>
      )}

      <div className="card">
        <div className="card-title"><span className="card-title-icon">🔧</span> Ordens de Serviço ({(ordens || []).length})</div>
        {loading ? <Loading /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>OS #</th><th>Equipamento</th><th>Tipo</th><th>Prioridade</th><th>Técnico</th><th>Status</th><th>Criada em</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {(ordens || []).map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>#{String(o.id).slice(-6)}</td>
                    <td style={{ fontSize: 12 }}>{o.plantaNome}<br /><span style={{ color: "var(--text-3)" }}>{o.descricao?.slice(0, 40)}</span></td>
                    <td><span className="badge badge-info">{o.tipo}</span></td>
                    <td><span className={`badge ${o.prioridade === "critica" ? "badge-danger" : o.prioridade === "alta" ? "badge-warning" : "badge-info"}`}>{o.prioridade}</span></td>
                    <td style={{ fontSize: 12 }}>{o.tecnico || "—"}</td>
                    <td><span className={`badge ${STATUS_ORDEM[o.status] || "badge-info"}`}>{o.status}</span></td>
                    <td style={{ fontSize: 11 }}>{new Date(o.criadaEm).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <select className="input select-tiny" value={o.status} onChange={e => atualizarStatus(o.id, e.target.value)}>
                        <option value="aberta">Aberta</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="concluida">Concluída</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(ordens || []).length === 0 && <div className="empty">Nenhuma ordem de serviço cadastrada</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DIAGNÓSTICO IA
// ============================================
function PageIA({ plantaId }) {
  const { data: falhas } = useFetch(`${API}/api/falhas${plantaId ? `?planta_id=${plantaId}` : ""}`);
  const [selIdx, setSel]     = useState("");
  const [result, setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [enviandoWpp, setEnviandoWpp] = useState(false);

  const falhasAtivas = (falhas || []).filter(f => f.ativa);
  const falha = selIdx !== "" ? falhasAtivas[parseInt(selIdx)] : null;

  /**
   * [IA] Chama o endpoint /api/ia/diagnostico do backend.
   * O backend usa Groq SDK com modelo llama-3.3-70b-versatile.
   * A IA recebe os dados da falha e retorna diagnóstico + recomendações.
   */
  const analisar = async () => {
    if (!falha) return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/ia/diagnostico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ falha }),
      });
      const d = await r.json();
      setResult(d);
    } catch (e) {
      setResult({ erro: "Erro ao conectar com a IA: " + e.message });
    }
    setLoading(false);
  };

  /**
   * [WhatsApp] Envia diagnóstico via CallMeBot.
   * Chama /api/whatsapp/notificar com a falha e o diagnóstico gerado pela IA.
   */
  const enviarWhatsApp = async () => {
    if (!falha || !result) return;
    setEnviandoWpp(true);
    try {
      const r = await fetch(`${API}/api/whatsapp/notificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ falha, diagnostico: result }),
      });
      const d = await r.json();
      if (d.ok) alert("✅ Mensagem enviada com sucesso no WhatsApp!");
      else alert("❌ Erro: " + d.erro);
    } catch (e) {
      alert("❌ Erro: " + e.message);
    }
    setEnviandoWpp(false);
  };

  const URGENCIA_CLS = { critica: "badge-danger", alta: "badge-warning", media: "badge-info", baixa: "badge-success" };

  return (
    <div className="page">
      <div className="card">
        <div className="card-title"><span className="card-title-icon">🤖</span> Diagnóstico por Inteligência Artificial</div>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14, lineHeight: 1.6 }}>
          Selecione uma falha ativa para análise automática com IA — diagnóstico técnico, causa provável e recomendações de ação imediata.
          <br />
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            🤖 Modelo: Groq llama-3.3-70b-versatile · API gratuita
          </span>
        </p>

        <select className="input" value={selIdx} onChange={e => { setSel(e.target.value); setResult(null); }}>
          <option value="">Selecione uma falha para analisar...</option>
          {falhasAtivas.map((f, i) => (
            <option key={f.id} value={i}>
              [{f.criticidade}] {f.equipamentoTag} · {f.descricao} · {f.tempo}
            </option>
          ))}
        </select>

        {falha && (
          <div style={{ background: "var(--bg-card2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "var(--text-2)" }}>
            <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{falha.descricao}</div>
            <div>{falha.plantaNome} · {falha.setor} · {falha.equipamentoNome}</div>
            <div style={{ marginTop: 4, color: "var(--text-3)" }}>TAG: {falha.equipamentoTag} · Ativo há: {falha.tempo}</div>
          </div>
        )}

        <button className="btn-primary" onClick={analisar} disabled={selIdx === "" || loading}>
          {loading ? "🧠 Analisando com IA..." : "🧠 Analisar com IA"}
        </button>
      </div>

      {result && (
        <div className="card ia-result ia-glow">
          <div className="ia-header">
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>Resultado da análise</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {result.urgencia && (
                <span className={`badge ${URGENCIA_CLS[result.urgencia] || "badge-info"}`}>
                  Urgência: {result.urgencia}
                </span>
              )}
              <button
                className="btn-sm btn-success"
                onClick={enviarWhatsApp}
                disabled={enviandoWpp}
              >
                {enviandoWpp ? "📤 Enviando..." : "📱 Enviar no WhatsApp"}
              </button>
            </div>
          </div>
          {result.erro ? (
            <div style={{ color: "var(--danger)", fontSize: 13 }}>⚠️ {result.erro}</div>
          ) : (
            <>
              <div>
                <div className="ia-section-label">🔍 Diagnóstico</div>
                <div className="ia-section-text">{result.diagnostico}</div>
              </div>
              <div>
                <div className="ia-section-label">✅ Recomendação</div>
                <div className="ia-section-text" style={{ whiteSpace: "pre-line" }}>{result.recomendacao}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// APP PRINCIPAL
// ============================================
export default function App() {
  const [page, setPage]       = useState("dashboard");
  const [plantaId, setPlantaId] = useState("");
  const { data: falhasData } = useFetch(`${API}/api/falhas`);
  const totalAlertas = (falhasData || []).filter(f => f.ativa && (f.criticidade === "C" || f.criticidade === "A")).length;

  const handleSetPlanta = (id) => {
    setPlantaId(id);
    setPage("dashboard");
  };

  return (
    <div className="app-layout">
      <Nav page={page} setPage={setPage} alertas={totalAlertas} />
      <div className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              {PAGES.find(p => p.id === page)?.icon} {PAGES.find(p => p.id === page)?.label}
            </h1>
            {plantaId && (
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                📍 Filtrando: Planta #{plantaId}
                <button className="btn-link" onClick={() => setPlantaId("")} style={{ marginLeft: 8 }}>✕ Limpar filtro</button>
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </header>

        {page === "dashboard"    && <PageDashboard    plantaId={plantaId} />}
        {page === "plantas"      && <PagePlantas      setPlantaId={handleSetPlanta} />}
        {page === "equipamentos" && <PageEquipamentos plantaId={plantaId} />}
        {page === "falhas"       && <PageFalhas       plantaId={plantaId} />}
        {page === "telemetria"   && <PageTelemetria   plantaId={plantaId} />}
        {page === "ordens"       && <PageOrdens       plantaId={plantaId} />}
        {page === "ia"           && <PageIA           plantaId={plantaId} />}
      </div>
    </div>
  );
}
