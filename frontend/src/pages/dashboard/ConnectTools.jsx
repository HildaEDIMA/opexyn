import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

const tools = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "✉️",
    description: "Alex will read and respond to customer emails",
    url: "https://mail.google.com",
    checkUrl: "/agent/check-session/gmail",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
    description: "Alex will handle WhatsApp Business messages",
    url: "https://web.whatsapp.com",
    checkUrl: "/agent/check-session/whatsapp",
  },
];

export default function ConnectTools() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState({
    gmail: "unknown",
    whatsapp: "unknown",
  });
  const [connecting, setConnecting] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    checkAllSessions();
  }, []);

  const checkAllSessions = async () => {
    for (const tool of tools) {
      try {
        const res = await api.get(tool.checkUrl);
        setStatuses(prev => ({
          ...prev,
          [tool.id]: res.data.valid ? "connected" : "disconnected"
        }));
      } catch {
        setStatuses(prev => ({ ...prev, [tool.id]: "disconnected" }));
      }
    }
  };

  const handleConnect = async (tool) => {
    setConnecting(tool.id);
    setMessage({
      type: "info",
      text: `Opening ${tool.name}... Please log in and then click "Save Session" below.`
    });

    try {
      // Demande à Alex d'ouvrir le navigateur sur le bon outil
      await api.post("/agent/open-browser", { url: tool.url, tool: tool.id });

      // Affiche les instructions
      setMessage({
        type: "warning",
        text: `Alex has opened ${tool.name} in his browser. 
               Please complete the login on the dashboard view, 
               then click "Save Session" to save your credentials.`
      });
    } catch (err) {
      setMessage({ type: "error", text: "Could not open browser. Is Alex running?" });
      setConnecting(null);
    }
  };

  const handleSaveSession = async () => {
    try {
      await api.post("/agent/save-session");
      setMessage({ type: "success", text: "Session saved successfully! Alex is now connected." });
      setStatuses(prev => ({ ...prev, [connecting]: "connected" }));
      setConnecting(null);
    } catch (err) {
      setMessage({ type: "error", text: "Could not save session. Please try again." });
    }
  };

  const statusColor = {
    connected: "#c8f03c",
    disconnected: "#f87171",
    unknown: "rgba(240,240,238,0.4)",
  };

  const statusLabel = {
    connected: "✓ Connected",
    disconnected: "Not connected",
    unknown: "Checking...",
  };

  return (
    <div style={styles.container}>
      <Sidebar active="Connect Tools" />

      <div style={styles.main}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.headerTitle}>Connect Alex's Tools</h2>
            <p style={styles.headerSub}>
              Connect your communication channels so Alex can start working.
              Your credentials are saved locally and never shared.
            </p>
          </div>
        </div>

        {message && (
          <div style={{
            ...styles.message,
            background: message.type === "success" ? "rgba(200,240,60,0.06)"
              : message.type === "error" ? "rgba(255,60,60,0.06)"
              : message.type === "warning" ? "rgba(250,204,21,0.06)"
              : "rgba(96,165,250,0.06)",
            borderColor: message.type === "success" ? "rgba(200,240,60,0.25)"
              : message.type === "error" ? "rgba(255,60,60,0.25)"
              : message.type === "warning" ? "rgba(250,204,21,0.25)"
              : "rgba(96,165,250,0.25)",
            color: message.type === "success" ? "#c8f03c"
              : message.type === "error" ? "#f87171"
              : message.type === "warning" ? "#facc15"
              : "#60a5fa",
          }}>
            {message.text}
          </div>
        )}

        {/* Tools */}
        <div style={styles.toolsGrid}>
          {tools.map((tool) => (
            <div key={tool.id} style={styles.toolCard}>
              <div style={styles.toolHeader}>
                <span style={styles.toolIcon}>{tool.icon}</span>
                <div>
                  <h3 style={styles.toolName}>{tool.name}</h3>
                  <p style={styles.toolDesc}>{tool.description}</p>
                </div>
                <div style={{
                  ...styles.toolStatus,
                  color: statusColor[statuses[tool.id]]
                }}>
                  {statusLabel[statuses[tool.id]]}
                </div>
              </div>

              <div style={styles.toolActions}>
                {statuses[tool.id] === "connected" ? (
                  <div style={styles.connectedRow}>
                    <span style={styles.connectedText}>
                      Alex is connected to {tool.name}
                    </span>
                    <button
                      style={styles.reconnectBtn}
                      onClick={() => handleConnect(tool)}
                    >
                      Reconnect
                    </button>
                  </div>
                ) : connecting === tool.id ? (
                  <div style={styles.connectingRow}>
                    <div style={styles.instructions}>
                      <p style={styles.instructionStep}>
                        <span style={styles.stepNum}>1</span>
                        Look at Alex's browser view on the dashboard
                      </p>
                      <p style={styles.instructionStep}>
                        <span style={styles.stepNum}>2</span>
                        Complete the {tool.name} login in Alex's browser
                      </p>
                      <p style={styles.instructionStep}>
                        <span style={styles.stepNum}>3</span>
                        Click "Save Session" when logged in
                      </p>
                    </div>
                    <button
                      style={styles.saveBtn}
                      onClick={handleSaveSession}
                    >
                      ✓ Save Session
                    </button>
                  </div>
                ) : (
                  <button
                    style={styles.connectBtn}
                    onClick={() => handleConnect(tool)}
                  >
                    Connect {tool.name}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Security note */}
        <div style={styles.securityNote}>
          <span style={styles.securityIcon}>🔒</span>
          <div>
            <strong style={styles.securityTitle}>Your data is secure</strong>
            <p style={styles.securityText}>
              Sessions are stored in your isolated Docker container.
              No passwords are stored — only browser session cookies,
              the same way your browser remembers you.
              Alex can only access accounts you explicitly connect.
            </p>
          </div>
        </div>

        {/* All connected — Launch Alex */}
        {Object.values(statuses).some(s => s === "connected") && (
          <div style={styles.launchSection}>
            <div>
              <h3 style={styles.launchTitle}>Ready to launch Alex</h3>
              <p style={styles.launchSub}>
                {Object.values(statuses).filter(s => s === "connected").length} tool(s) connected.
                Alex will start working immediately.
              </p>
            </div>
            <button
              style={styles.launchBtn}
              onClick={() => navigate("/agent/alex")}
            >
              🚀 Launch Alex
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "#0a0a0b",
    fontFamily: "'Inter', sans-serif",
    color: "#f0f0ee",
  },
  main: {
    marginLeft: "240px",
    flex: 1,
    padding: "48px 40px",
    boxSizing: "border-box",
  },
  header: {
    marginBottom: "36px",
  },
  headerTitle: {
    fontSize: "22px",
    fontWeight: "800",
    margin: "0 0 8px 0",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-0.5px",
    color: "#f0f0ee",
  },
  headerSub: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    lineHeight: 1.7,
    maxWidth: "520px",
    fontFamily: "'Inter', sans-serif",
  },
  message: {
    padding: "14px 18px",
    borderRadius: "10px",
    border: "1px solid",
    fontSize: "13px",
    marginBottom: "24px",
    lineHeight: 1.6,
    fontFamily: "'Inter', sans-serif",
  },
  toolsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "24px",
  },
  toolCard: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "12px",
    padding: "24px",
  },
  toolHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "16px",
  },
  toolIcon: {
    fontSize: "32px",
    flexShrink: 0,
  },
  toolName: {
    fontSize: "15px",
    fontWeight: "700",
    margin: "0 0 4px 0",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
  },
  toolDesc: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  toolStatus: {
    fontSize: "13px",
    fontWeight: "600",
    marginLeft: "auto",
    flexShrink: 0,
    fontFamily: "'Inter', sans-serif",
  },
  toolActions: {},
  connectedRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(200,240,60,0.06)",
    border: "1px solid rgba(200,240,60,0.25)",
    borderRadius: "8px",
    padding: "12px 16px",
  },
  connectedText: {
    fontSize: "13px",
    color: "#c8f03c",
    fontFamily: "'Inter', sans-serif",
  },
  reconnectBtn: {
    background: "transparent",
    border: "1px solid rgba(200,240,60,0.4)",
    color: "#c8f03c",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  connectingRow: {
    background: "rgba(250,204,21,0.05)",
    border: "1px solid rgba(250,204,21,0.3)",
    borderRadius: "8px",
    padding: "16px",
  },
  instructions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "16px",
  },
  instructionStep: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "#facc15",
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  stepNum: {
    width: "20px",
    height: "20px",
    background: "#facc15",
    color: "#0a0a0b",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "700",
    flexShrink: 0,
  },
  saveBtn: {
    background: "#facc15",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Syne', sans-serif",
  },
  connectBtn: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Syne', sans-serif",
  },
  securityNote: {
    display: "flex",
    gap: "16px",
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
  },
  securityIcon: {
    fontSize: "24px",
    flexShrink: 0,
  },
  securityTitle: {
    fontSize: "14px",
    display: "block",
    marginBottom: "6px",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
  },
  securityText: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    lineHeight: 1.7,
    fontFamily: "'Inter', sans-serif",
  },
  launchSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#111111",
    border: "1px solid #c8f03c",
    borderRadius: "12px",
    padding: "24px 28px",
  },
  launchTitle: {
    fontSize: "16px",
    fontWeight: "700",
    margin: "0 0 4px 0",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
  },
  launchSub: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  launchBtn: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "12px 28px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "'Syne', sans-serif",
  },
};