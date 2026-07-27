import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";
import { getAgentStatusDisplay } from "../../utils/agentStatus";

const ThinkingDots = () => {
  const dotStyle = (delay) => ({
    width: 5, height: 5, borderRadius: "50%",
    background: "#c8f03c", display: "inline-block",
    margin: "0 2px",
    animation: "bounce 1.2s infinite ease-in-out",
    animationDelay: delay,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "10px 14px" }}>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
      <div style={dotStyle("0s")} />
      <div style={dotStyle("0.2s")} />
      <div style={dotStyle("0.4s")} />
    </div>
  );
};

const BACKEND_WS = "ws://localhost:8000/api";

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { agentId } = useParams();

  // Infos agent (nom personnalisé, poste, novnc_url dynamique)
  const [agentInfo, setAgentInfo] = useState(null);

  // État agent
  const [status, setStatus] = useState("connecting");
  const [isBusy, setIsBusy] = useState(false);
  const [logs, setLogs] = useState([]);

  // Demandes d'approbation en attente
  const [approvals, setApprovals] = useState([]);
  const [respondingTo, setRespondingTo] = useState(null);

  // Chat — namespacé par agent
  const storageKey = `agent_chat_${agentId}`;
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const thinkingWatchdogRef = useRef(null);

  const agentName = agentInfo?.name || "Agent";

  // ── Infos agent (nom + novnc_url) ─────────────────────────────────────────

  useEffect(() => {
    if (!agentId) return;
    fetchAgentInfo();
  }, [agentId]);

  const fetchAgentInfo = async () => {
    try {
      const res = await api.get(`/agent/agent-info/${agentId}`);
      setAgentInfo(res.data);
    } catch (err) {
      console.error("Failed to load agent info", err);
    }
  };

  // ── Approbations en attente ────────────────────────────────────────────────

  useEffect(() => {
    if (!agentId) return;
    fetchApprovals();
    const t = setInterval(fetchApprovals, 10000); // filet de sécurité si le WS rate un message
    return () => clearInterval(t);
  }, [agentId]);

  const fetchApprovals = async () => {
    try {
      const res = await api.get(`/agent/approvals/${agentId}`);
      setApprovals(res.data);
    } catch (err) {
      console.error("Failed to load approvals", err);
    }
  };

  const respondToApproval = async (approvalId, approved) => {
    setRespondingTo(approvalId);
    try {
      await api.post(`/agent/approvals/${approvalId}/respond`, { approved });
      setApprovals(prev => prev.filter(a => a.id !== approvalId));
    } catch (err) {
      console.error("Failed to respond to approval", err);
    } finally {
      setRespondingTo(null);
    }
  };

  // ── WebSocket (proxy backend authentifié) ─────────────────────────────────

  useEffect(() => {
    if (!agentId) return;
    connectWS();
    return () => {
      intentionalCloseRef.current = true;
      wsRef.current?.close();
      clearTimeout(thinkingWatchdogRef.current);
    };
  }, [agentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    if (!agentId) return;
    fetchStatus();
    const t = setInterval(fetchStatus, 4000);
    return () => clearInterval(t);
  }, [agentId]);

  const connectWS = () => {
    intentionalCloseRef.current = false;
    const token = localStorage.getItem("token");
    const ws = new WebSocket(`${BACKEND_WS}/agent/ws/${agentId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("active");
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 20000);
      ws._ping = ping;
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      handleWSMessage(msg);
    };

    ws.onclose = () => {
      setStatus("offline");
      clearInterval(ws._ping);
      // Ne PAS reconnecter si cette fermeture est volontaire (cleanup du composant,
      // ex: démontage/remontage React) — sinon on crée une connexion fantôme en
      // plus de la nouvelle, et chaque broadcast serveur (notify_client, task_done,
      // wait_for_human_handoff) arrive en double sur le dashboard.
      if (!intentionalCloseRef.current) {
        setTimeout(connectWS, 3000);
      }
    };

    ws.onerror = () => ws.close();
  };

  const handleWSMessage = (msg) => {
    switch (msg.type) {
      case "connected":
        setIsBusy(msg.is_busy || false);
        if (!msg.is_busy) {
          setIsThinking(false);
          clearTimeout(thinkingWatchdogRef.current);
        }
        break;
      case "chat_ack":
        setIsThinking(true);
        // Filet de sécurité : si aucun chat_reply n'arrive dans les 2 minutes
        // (message de broadcast perdu, connexion WS ayant raté l'event...),
        // on débloque l'input plutôt que de laisser "réfléchit…" tourner
        // indéfiniment. Le polling /status (fetchStatus, toutes les 4s)
        // continuera de refléter l'état réel de l'agent.
        clearTimeout(thinkingWatchdogRef.current);
        thinkingWatchdogRef.current = setTimeout(() => {
          setIsThinking(false);
        }, 120000);
        break;
      case "chat_reply":
        setIsThinking(false);
        clearTimeout(thinkingWatchdogRef.current);
        setIsBusy(msg.is_busy || false);
        setMessages(prev => {
          // Garde-fou anti-doublon : si le même contenu agent au même timestamp
          // est déjà présent (ex: broadcast reçu deux fois sur une connexion WS
          // dupliquée), on ne l'ajoute pas une seconde fois.
          const isDuplicate = prev.some(
            m => m.role === "agent" && m.content === msg.content && m.ts === msg.timestamp
          );
          if (isDuplicate) return prev;
          return [...prev, {
            role: "agent",
            content: msg.content,
            ts: msg.timestamp
          }];
        });
        break;
      case "approval_request":
        // Ajout immédiat — évite d'attendre le prochain polling de fetchApprovals
        setApprovals(prev => {
          if (prev.some(a => a.id === msg.approval_id)) return prev;
          return [
            { id: msg.approval_id, action_description: msg.action_description, created_at: msg.timestamp },
            ...prev,
          ];
        });
        break;
      case "screenshot":
        if (msg.logs) setLogs(msg.logs);
        break;
      case "pong":
        break;
      default:
        if (msg.logs) setLogs(msg.logs);
    }
  };

  // ── HTTP fallback ───────────────────────────────────────────────────────────

  const fetchStatus = () => {
    api.get(`/agent/status/${agentId}`)
      .then(res => {
        setStatus(res.data.status || "active");
        setIsBusy(res.data.is_busy || false);
        if (res.data.logs) setLogs(res.data.logs);
      })
      .catch(() => {});
  };

  // ── Envoi d'un message ──────────────────────────────────────────────────────

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isThinking) return;

    setMessages(prev => [...prev, {
      role: "user",
      content: text,
      ts: new Date().toISOString()
    }]);
    setInput("");
    inputRef.current?.focus();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", content: text }));
    } else {
      api.post(`/agent/instruction/${agentId}`, { instruction: text }).catch(() => {});
    }
  };

  // ── Status colors ───────────────────────────────────────────────────────────

  const sc = getAgentStatusDisplay({ status, is_busy: isBusy });

  const LOG_COLOR = { done: "#c8f03c", error: "#f87171", sleep: "#a78bfa", wake: "#facc15", info: "#60a5fa" };

  const formatElapsed = (isoString) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    return `${mins} min ago`;
  };

  return (
    <div style={S.root}>

      {/* ── Sidebar ── */}
      <Sidebar active="Dashboard" />

      {/* ── Main ── */}
      <div style={S.main}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div>
              <h2 style={S.agentNameStyle}>{agentName}</h2>
              <p style={S.agentRole}>{agentInfo?.role_display_name || "AI Employee"}</p>
            </div>
            <div style={{ ...S.badge, borderColor: `${sc.color}33`, background: `${sc.color}0d` }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc.color,
                boxShadow: isBusy ? `0 0 8px ${sc.color}` : "none",
                animation: isBusy ? "pulse 1.5s infinite" : "none"
              }} />
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
              <span style={{ color: sc.color, fontSize: 12, fontWeight: 600, fontFamily: "Inter,sans-serif" }}>
                {sc.label}
              </span>
            </div>
          </div>
          <button style={S.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
        </div>

        {/* ── Bannière d'approbation — visible uniquement s'il y a des demandes en attente ── */}
        {approvals.length > 0 && (
          <div style={S.approvalStack}>
            {approvals.map(a => (
              <div key={a.id} style={S.approvalCard}>
                <div style={S.approvalIcon}>⏸</div>
                <div style={S.approvalContent}>
                  <div style={S.approvalHeader}>
                    <span style={S.approvalLabel}>{agentName} is waiting for your approval</span>
                    <span style={S.approvalTime}>{formatElapsed(a.created_at)}</span>
                  </div>
                  <p style={S.approvalDesc}>{a.action_description}</p>
                </div>
                <div style={S.approvalActions}>
                  <button
                    style={{ ...S.approvalBtn, ...S.approvalReject, opacity: respondingTo === a.id ? 0.5 : 1 }}
                    onClick={() => respondToApproval(a.id, false)}
                    disabled={respondingTo === a.id}
                  >
                    Reject
                  </button>
                  <button
                    style={{ ...S.approvalBtn, ...S.approvalApprove, opacity: respondingTo === a.id ? 0.5 : 1 }}
                    onClick={() => respondToApproval(a.id, true)}
                    disabled={respondingTo === a.id}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid principal */}
        <div style={S.grid}>

          {/* ── Colonne gauche : bureau virtuel + activité en direct ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Bureau virtuel — URL noVNC dynamique */}
            <div style={S.desktopCard}>
              <div style={S.desktopBar}>
                <div style={S.desktopDots}>
                  <div style={{ ...S.dot, background: "#ff5f57" }} />
                  <div style={{ ...S.dot, background: "#febc2e" }} />
                  <div style={{ ...S.dot, background: "#28c840" }} />
                </div>
                <div style={S.desktopUrl}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: isBusy ? "#60a5fa" : "#c8f03c",
                    boxShadow: `0 0 6px ${isBusy ? "#60a5fa" : "#c8f03c"}`,
                    animation: isBusy ? "pulse 1.5s infinite" : "none"
                  }} />
                  {isBusy ? `${agentName} travaille…` : `Bureau de ${agentName} — en direct`}
                </div>
              </div>

              {agentInfo?.novnc_url ? (
                <iframe
                  src={agentInfo.novnc_url}
                  style={S.vncFrame}
                  title={`${agentName} Desktop`}
                  allow="clipboard-read; clipboard-write"
                />
              ) : (
                <div style={{ ...S.vncFrame, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(240,240,238,0.3)", fontSize: 13 }}>
                  Démarrage du bureau virtuel…
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div style={S.card}>
              <div style={S.cardLabel}>Activité en direct</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 180, overflowY: "auto" }}>
                {logs.length === 0
                  ? <p style={S.empty}>En attente...</p>
                  : logs.map((log, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "rgba(240,240,238,0.18)", flexShrink: 0, fontFamily: "monospace", paddingTop: 2 }}>
                        {log.time}
                      </span>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: LOG_COLOR[log.status] || "#60a5fa", flexShrink: 0, marginTop: 4 }} />
                      <span style={{ fontSize: 12, color: "rgba(240,240,238,0.5)", lineHeight: 1.5, fontFamily: "Inter,sans-serif" }}>
                        {log.action}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* ── Colonne droite : chat, seul, s'étire sur toute la hauteur ── */}
          <div style={{ display: "flex", flexDirection: "column" }}>

            {/* Chat */}
            <div style={S.chatCard}>
              <div style={S.cardLabel}>Chat avec {agentName}</div>

              <div style={S.chatHistory}>
                {messages.length === 0 && (
                  <p style={{ ...S.empty, textAlign: "center", marginTop: 24 }}>
                    Donne une instruction à {agentName}.<br/>
                    <span style={{ fontSize: 11, opacity: 0.5 }}>Il l'exécutera sur son ordinateur.</span>
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column",
                    alignItems: m.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 10
                  }}>
                    <div style={m.role === "user" ? S.bubbleUser : S.bubbleAgent}>
                      {m.content}
                    </div>
                    <span style={S.bubbleTs}>
                      {m.role === "user" ? "Toi" : agentName} · {new Date(m.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}

                {isThinking && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ ...S.bubbleAgent, padding: "2px 4px" }}>
                      <ThinkingDots />
                    </div>
                    <span style={S.bubbleTs}>{agentName} réfléchit…</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <div style={S.chatInput}>
                <input
                  ref={inputRef}
                  style={S.input}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder={isThinking ? `${agentName} travaille…` : `Instruis ${agentName}…`}
                  disabled={isThinking}
                />
                <button
                  style={{ ...S.sendBtn, opacity: isThinking ? 0.4 : 1, cursor: isThinking ? "not-allowed" : "pointer" }}
                  onClick={sendMessage}
                  disabled={isThinking}
                >→</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  root: { display: "flex", minHeight: "100vh", background: "#0a0a0b", color: "#f0f0ee" },
  main: { marginLeft: 240, flex: 1, padding: "48px 40px", boxSizing: "border-box" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  agentNameStyle: { fontSize: 18, fontWeight: 800, margin: "0 0 2px", fontFamily: "Syne,sans-serif", letterSpacing: "-0.3px" },
  agentRole: { fontSize: 11, color: "rgba(240,240,238,0.3)", margin: 0, fontFamily: "Inter,sans-serif" },
  badge: { display: "flex", alignItems: "center", gap: 6, border: "1px solid", borderRadius: 20, padding: "4px 10px" },
  backBtn: { background: "transparent", border: "1px solid #1e1e1e", color: "rgba(240,240,238,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Inter,sans-serif" },

  // Bannière approbation
  approvalStack: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 },
  approvalCard: {
    display: "flex", alignItems: "flex-start", gap: 14,
    background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.25)",
    borderRadius: 12, padding: "16px 18px",
  },
  approvalIcon: { fontSize: 18, color: "#facc15", flexShrink: 0, lineHeight: "20px" },
  approvalContent: { flex: 1, minWidth: 0 },
  approvalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  approvalLabel: { fontSize: 12, fontWeight: 700, color: "#facc15", fontFamily: "Syne,sans-serif" },
  approvalTime: { fontSize: 10, color: "rgba(240,240,238,0.3)", fontFamily: "Inter,sans-serif", flexShrink: 0, marginLeft: 12 },
  approvalDesc: { fontSize: 13, color: "rgba(240,240,238,0.75)", margin: 0, lineHeight: 1.5, fontFamily: "Inter,sans-serif" },
  approvalActions: { display: "flex", gap: 8, flexShrink: 0 },
  approvalBtn: {
    border: "1px solid", borderRadius: 7, padding: "8px 16px",
    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Syne,sans-serif",
    transition: "opacity 0.15s",
  },
  approvalReject: { background: "transparent", borderColor: "rgba(248,113,113,0.3)", color: "#f87171" },
  approvalApprove: { background: "#c8f03c", borderColor: "#c8f03c", color: "#0a0a0b" },


  grid: { display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 },

  // Bureau
  desktopCard: { background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", height: 580 },
  desktopBar:  { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#161616", borderBottom: "1px solid #1a1a1a", flexShrink: 0 },
  desktopDots: { display: "flex", gap: 6 },
  dot:         { width: 11, height: 11, borderRadius: "50%" },
  desktopUrl:  { flex: 1, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "rgba(240,240,238,0.25)", fontFamily: "monospace" },
  vncFrame:    { flex: 1, width: "100%", border: "none", display: "block", background: "#000", minHeight: 0, overflow: "hidden" },
  card:        { background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 18 },
  cardLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(240,240,238,0.3)", fontFamily: "Inter,sans-serif", marginBottom: 14 },
  empty:     { fontSize: 12, color: "rgba(240,240,238,0.2)", margin: 0, fontFamily: "Inter,sans-serif", lineHeight: 1.6 },

  // Chat
  chatCard:    { background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", height: 580 },
  chatHistory: { flex: 1, overflowY: "auto", marginBottom: 12, paddingRight: 4, minHeight: 200 },
  chatInput:   { display: "flex", gap: 8 },

  bubbleUser: {
    background: "rgba(200,240,60,0.1)", border: "1px solid rgba(200,240,60,0.2)",
    color: "#f0f0ee", borderRadius: "12px 12px 2px 12px",
    padding: "9px 13px", fontSize: 13, fontFamily: "Inter,sans-serif",
    lineHeight: 1.5, maxWidth: "85%", wordBreak: "break-word"
  },
  bubbleAgent: {
    background: "#1a1a1a", border: "1px solid #222",
    color: "rgba(240,240,238,0.75)", borderRadius: "12px 12px 12px 2px",
    padding: "9px 13px", fontSize: 13, fontFamily: "Inter,sans-serif",
    lineHeight: 1.5, maxWidth: "85%", wordBreak: "break-word"
  },
  bubbleTs: {
    fontSize: 10, color: "rgba(240,240,238,0.2)",
    fontFamily: "Inter,sans-serif", marginTop: 4, padding: "0 4px"
  },

  input:   { flex: 1, background: "#0a0a0b", border: "1px solid #1e1e1e", borderRadius: 8, padding: "9px 12px", color: "#f0f0ee", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif" },
  sendBtn: { background: "#c8f03c", color: "#0a0a0b", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 700 },
};