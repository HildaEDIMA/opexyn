import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";
import { getAgentStatusDisplay } from "../../utils/agentStatus";

export default function Dashboard() {
  const { client, fetchMe, logout, token } = useAuthStore();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [agentStatuses, setAgentStatuses] = useState({}); // keyed by agent.id
  const [screenshots, setScreenshots] = useState({});     // keyed by agent.id

  // ── Suppression d'agent ─────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMe();

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      window.history.replaceState({}, "", "/dashboard");
      goToOnboardingForNewAgent();
    } else {
      fetchAgents();
    }
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await api.get("/agent/my-agents");
      setAgents(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  // Après un paiement Stripe réussi, le webhook crée l'agent côté backend
  // (status "pending_onboarding") de façon asynchrone — il peut ne pas être
  // encore visible au premier fetch. On retente quelques fois avant d'abandonner
  // plutôt que de deviner aveuglément via un setTimeout fixe.
  const goToOnboardingForNewAgent = async (attempt = 0) => {
    const currentAgents = await fetchAgents();
    const pending = currentAgents.find(a => a.status === "pending_onboarding");

    if (pending) {
      navigate(`/agent/${pending.id}/onboarding`, { replace: true });
      return;
    }

    if (attempt < 5) {
      setTimeout(() => goToOnboardingForNewAgent(attempt + 1), 800);
    }
    // Après 5 tentatives (~4s), on abandonne silencieusement : l'utilisateur
    // reste sur le dashboard et verra l'agent apparaître dès qu'il sera prêt.
  };

  // Récupère le statut de CHAQUE agent individuellement
  const fetchAgentStatus = async (agentId) => {
    try {
      const res = await api.get(`/agent/status/${agentId}`);
      setAgentStatuses(prev => ({ ...prev, [agentId]: res.data }));
    } catch {}
  };

  // Passe par le backend (proxy authentifié) — jamais d'appel direct à un port
  // de container, qui est désormais dynamique par agent.
  const fetchAgentScreenshot = async (agentId) => {
    try {
      const res = await api.get(`/agent/screenshot/${agentId}`);
      if (res.data.screenshot) {
        setScreenshots(prev => ({ ...prev, [agentId]: res.data.screenshot }));
      }
    } catch {}
  };

  useEffect(() => {
    if (agents.length === 0) return;

    const fetchAll = () => {
      agents.forEach(agent => {
        fetchAgentStatus(agent.id);
        fetchAgentScreenshot(agent.id);
      });
    };

    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [agents]);

  // ── Suppression ──────────────────────────────────────────────────────────

  const handleDeleteAgent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/agent/${deleteTarget.id}`);
      setAgents(prev => prev.filter(a => a.id !== deleteTarget.id));
      setAgentStatuses(prev => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setScreenshots(prev => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={s.container}>
      <Sidebar active="Dashboard" />

      <div style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.headerTitle}>
              Welcome back{client?.full_name ? `, ${client.full_name.split(" ")[0]}` : ""}
            </h2>
            <p style={s.headerSub}>
              {client?.company_name || "Your company"} — AI Workforce Overview
            </p>
          </div>
          <button style={s.addBtn} onClick={() => navigate("/marketplace")}>
            + Add AI Employee
          </button>
        </div>

        {/* Active agents with sandbox miniature */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Your AI Employees ({agents.length})</h3>

          {agents.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyHex}>
                <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="24,3 40,12 40,36 24,45 8,36 8,12" fill="none" stroke="#c8f03c" strokeWidth="1.5"/>
                  <polygon points="24,10 34,16 34,32 24,38 14,32 14,16" fill="rgba(200,240,60,0.1)"/>
                </svg>
              </div>
              <p style={s.emptyTitle}>No AI employees yet</p>
              <p style={s.emptySub}>Go to the Marketplace to deploy your first agent</p>
              <button style={s.addBtn} onClick={() => navigate("/marketplace")}>
                Explore Marketplace
              </button>
            </div>
          ) : (
            <div style={s.agentCards}>
              {agents.map((agent) => {
                const agentStatus = agentStatuses[agent.id];
                const sc = getAgentStatusDisplay(agentStatus);
                const isSleeping = sc.key === "sleeping";
                const isWorking = sc.key === "working";
                const screenshot = screenshots[agent.id];

                return (
                  <div key={agent.id} style={s.agentCard}>
                    {/* Left — Sandbox miniature */}
                    <div style={s.sandboxMini}>
                      <div style={s.sandboxHeader}>
                        <div style={s.sandboxDots}>
                          <div style={{ ...s.dot, background: "#ff5f57" }} />
                          <div style={{ ...s.dot, background: "#febc2e" }} />
                          <div style={{ ...s.dot, background: "#28c840" }} />
                        </div>
                        <div style={{
                          ...s.liveIndicator,
                          background: sc.color,
                          animation: isWorking ? "pulse 2s infinite" : "none",
                          marginLeft: "auto",
                        }} />
                      </div>

                      <div style={s.sandboxScreen}>
                        {screenshot ? (
                          <img
                            src={`data:image/png;base64,${screenshot}`}
                            alt={`${agent.name} sandbox`}
                            style={s.sandboxImg}
                          />
                        ) : (
                          <div style={s.sandboxEmpty}>
                            {isSleeping ? (
                              <>
                                <p style={s.sleepIcon}>—</p>
                                <p style={s.sleepText}>Sleeping</p>
                              </>
                            ) : (
                              <p style={s.sleepText}>{sc.label}…</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Centre — Infos agent (personnalisées) */}
                    <div style={s.agentInfo}>
                      <h4 style={s.agentName}>{agent.name}</h4>
                      <p style={s.agentRole}>{agent.role_display_name || "AI Employee"}</p>
                      <p style={s.agentPlan}>
                        Plan <span style={{ color: "rgba(200,240,60,0.5)", marginLeft: "4px" }}>{agent.subscription_plan || "—"}</span>
                      </p>
                    </div>

                    {/* Droite — Badge + Actions */}
                    <div style={s.agentActions}>
                      <div style={{
                        ...s.statusBadge,
                        background: `${sc.color}0d`,
                        borderColor: `${sc.color}33`,
                        color: sc.color,
                      }}>
                        <div style={{
                          width: "5px", height: "5px", borderRadius: "50%",
                          background: sc.color,
                          animation: isWorking ? "pulse 2s infinite" : "none",
                          opacity: 0.8,
                        }} />
                        {sc.label}
                      </div>
                      <div style={s.agentBtns}>
                        <button style={s.viewBtn} onClick={() => navigate(`/agent/${agent.id}`)}>
                          View →
                        </button>
                        <button style={s.configBtn} onClick={() => navigate(`/agent/${agent.id}/onboarding`)}>
                          Configure
                        </button>
                        <button style={s.deleteBtn} onClick={() => setDeleteTarget(agent)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modale de confirmation de suppression */}
      {deleteTarget && (
        <div style={s.modalOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <p style={s.modalTitle}>Delete {deleteTarget.name}?</p>
            <p style={s.modalSub}>
              This will permanently stop and remove this AI employee.
              This action cannot be undone.
            </p>
            <div style={s.modalBtns}>
              <button style={s.modalCancel} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                style={{ ...s.modalConfirm, background: "#f87171", opacity: deleting ? 0.6 : 1 }}
                onClick={handleDeleteAgent}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

const s = {
  container: {
    display: "flex", minHeight: "100vh",
    background: "#0a0a0b", fontFamily: "'Inter', sans-serif", color: "#f0f0ee",
  },
  main: { marginLeft: "240px", flex: 1, padding: "48px 40px", boxSizing: "border-box" },
  header: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "36px",
  },
  headerTitle: {
    fontSize: "22px", fontWeight: "800", margin: "0 0 4px 0",
    fontFamily: "'Syne', sans-serif", letterSpacing: "-0.5px",
  },
  headerSub: { fontSize: "13px", color: "rgba(240,240,238,0.4)", margin: 0 },
  addBtn: {
    background: "#c8f03c", color: "#0a0a0b", border: "none",
    borderRadius: "8px", padding: "10px 20px", fontSize: "13px",
    fontWeight: "700", cursor: "pointer", fontFamily: "'Syne', sans-serif",
  },
  section: {
    background: "#111111", border: "1px solid #1e1e1e",
    borderRadius: "12px", padding: "24px",
  },
  sectionTitle: {
    fontSize: "14px", fontWeight: "700", margin: "0 0 20px 0",
    fontFamily: "'Syne', sans-serif",
  },
  emptyState: {
    display: "flex", flexDirection: "column",
    alignItems: "center", padding: "48px 0", gap: "8px",
  },
  emptyHex: { marginBottom: "8px" },
  emptyTitle: {
    fontSize: "15px", fontWeight: "700", color: "#f0f0ee",
    margin: 0, fontFamily: "'Syne', sans-serif",
  },
  emptySub: {
    fontSize: "13px", color: "rgba(240,240,238,0.4)",
    margin: "0 0 16px 0", fontFamily: "'Inter', sans-serif",
  },
  agentCards: { display: "flex", flexDirection: "column", gap: "12px" },
  agentCard: {
    display: "flex", gap: "20px", alignItems: "stretch",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid #1e1e1e", borderRadius: "12px", padding: "18px 20px",
  },
  agentInfo: {
    display: "flex", flexDirection: "column",
    justifyContent: "center",
    gap: "5px", flex: 1, paddingLeft: "6px",
  },
  agentName: {
    fontSize: "13px", fontWeight: "600", margin: "0 0 2px 0",
    fontFamily: "'Syne', sans-serif",
    color: "rgba(240,240,238,0.7)",
  },
  agentRole: { fontSize: "11px", color: "rgba(240,240,238,0.25)", margin: 0 },
  statusBadge: {
    display: "inline-flex", alignItems: "center", gap: "5px",
    border: "1px solid", borderRadius: "20px", padding: "3px 9px",
    fontSize: "10px", fontWeight: "500", alignSelf: "flex-start",
  },
  agentPlan: {
    fontSize: "11px", color: "rgba(240,240,238,0.22)", margin: 0,
    letterSpacing: "0.2px",
  },
  agentActions: {
    display: "flex", flexDirection: "column",
    justifyContent: "space-between", alignItems: "flex-end",
    flexShrink: 0, gap: "10px",
  },
  agentBtns: { display: "flex", gap: "6px", alignItems: "center" },
  viewBtn: {
    background: "rgba(200,240,60,0.08)", color: "rgba(200,240,60,0.65)",
    border: "1px solid rgba(200,240,60,0.18)",
    borderRadius: "7px", padding: "7px 14px", fontSize: "11px",
    fontWeight: "600", cursor: "pointer", fontFamily: "'Syne', sans-serif",
    letterSpacing: "0.2px",
  },
  configBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
    color: "rgba(240,240,238,0.28)", borderRadius: "7px",
    padding: "7px 14px", fontSize: "11px", cursor: "pointer",
    letterSpacing: "0.2px",
  },
  deleteBtn: {
    background: "transparent", border: "1px solid rgba(248,113,113,0.2)",
    color: "rgba(248,113,113,0.6)", borderRadius: "7px",
    padding: "7px 14px", fontSize: "11px", cursor: "pointer",
    letterSpacing: "0.2px", fontFamily: "'Inter', sans-serif",
  },
  sandboxMini: {
    width: "160px", height: "110px", flexShrink: 0,
    background: "#0a0a0b", border: "1px solid #1e1e1e",
    borderRadius: "10px", overflow: "hidden",
    display: "flex", flexDirection: "column",
  },
  sandboxHeader: {
    display: "flex", alignItems: "center", gap: "4px",
    padding: "5px 7px", background: "#111111",
    borderBottom: "1px solid #1e1e1e",
  },
  sandboxDots: { display: "flex", gap: "3px" },
  dot: { width: "5px", height: "5px", borderRadius: "50%" },
  liveIndicator: { width: "5px", height: "5px", borderRadius: "50%" },
  sandboxScreen: {
    flex: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  sandboxImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  sandboxEmpty: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "3px", padding: "6px", height: "100%",
  },
  sleepIcon: { fontSize: "14px", margin: 0, color: "#444" },
  sleepText: {
    fontSize: "9px", fontWeight: "500", color: "rgba(240,240,238,0.4)", margin: 0, textAlign: "center",
  },
};