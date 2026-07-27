import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

const Logo = () => (
  <svg width="140" viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>{'@import url(\'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap\')'}</style>
    </defs>
    <polygon points="18,4 30,4 36,14 30,24 18,24 12,14" fill="none" stroke="#c8f03c" strokeWidth="1.5"/>
    <polygon points="21,8 27,8 30,14 27,20 21,20 18,14" fill="#c8f03c"/>
    <text x="46" y="20" fontFamily="Syne, sans-serif" fontWeight="800" fontSize="22" fill="#f0f0ee" letterSpacing="-0.5">Opex</text>
    <text x="134" y="20" fontFamily="Syne, sans-serif" fontWeight="800" fontSize="22" fill="#c8f03c" letterSpacing="-0.5">yn</text>
    <text x="46" y="34" fontFamily="Syne, sans-serif" fontWeight="400" fontSize="9" fill="rgba(240,240,238,0.4)" letterSpacing="2.5">AI WORKFORCE</text>
  </svg>
);

const STEPS = ["Briefing", "Access", "Autonomy"];

const TOOLS = [
  { id: "gmail", icon: "✉", name: "Gmail", desc: "Read and reply to support emails" },
  { id: "whatsapp", icon: "W", name: "WhatsApp Business", desc: "Handle WhatsApp messages" },
  { id: "instagram", icon: "IG", name: "Instagram", desc: "Respond to DMs and comments" },
];

export default function OnboardingAlex() {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [agentName, setAgentName] = useState("your agent");
  const [roleDisplayName, setRoleDisplayName] = useState(null);
  const [form, setForm] = useState({
    briefing: "",
    tools: [],
    autonomy_mode: "learning",
    rules: {
      reply_email: "autonomous",
      send_followup: "autonomous",
      offer_discount: "validate",
      escalate: "always_alert",
    }
  });

  useEffect(() => {
    if (!agentId) return;
    api.get(`/agent/agent-info/${agentId}`)
      .then(res => {
        if (res.data?.name) setAgentName(res.data.name);
        if (res.data?.role_display_name) setRoleDisplayName(res.data.role_display_name);
      })
      .catch(err => console.error("Failed to load agent info:", err));
  }, [agentId]);

  const toggleTool = (id) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(id)
        ? f.tools.filter(t => t !== id)
        : [...f.tools, id]
    }));
  };

  const setRule = (action, value) => {
    setForm(f => ({ ...f, rules: { ...f.rules, [action]: value } }));
  };

  const finish = async () => {
    if (!agentId) {
      setError("Agent introuvable — merci de revenir au dashboard et réessayer.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/agent/onboarding/${agentId}`, {
        briefing: form.briefing,
        tools: form.tools,
        autonomy_mode: form.autonomy_mode,
        rules: form.rules,
      });
      navigate(`/agent/${agentId}`);
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue lors de l'activation. Merci de réessayer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.grid} />

      {/* Top bar */}
      <div style={s.topBar}>
        <Logo />
        <div style={s.stepIndicator}>
          <span style={s.agentLabel}>💬 {agentName} — Configuration</span>
          <div style={s.steps}>
            {STEPS.map((st, i) => (
              <div key={i} style={s.stepItem}>
                <div style={{
                  ...s.stepDot,
                  background: step > i + 1 ? "#c8f03c" : step === i + 1 ? "#c8f03c" : "#1e1e1e",
                  border: step === i + 1 ? "2px solid #c8f03c" : "2px solid transparent",
                }} />
                <span style={{
                  ...s.stepText,
                  color: step === i + 1 ? "#c8f03c" : "rgba(240,240,238,0.3)",
                }}>{st}</span>
              </div>
            ))}
          </div>
          <span style={s.stepCount}>Step {step}/3</span>
        </div>
      </div>

      {/* Step 1 — Briefing */}
      {step === 1 && (
        <div style={s.content}>
          <p style={s.tag}>BRIEFING</p>
          <h1 style={s.title}>Talk to {agentName} like a new employee.</h1>
          <p style={s.sub}>
            Tell {agentName} everything about your company, your customers, your tone.<br />
            The more detail you give, the better {agentName} will perform.
          </p>

          <div style={s.exampleBox}>
            <p style={s.exampleLabel}>Example</p>
            <p style={s.exampleText}>
              "Hi {agentName}. You work for Opexyn, a B2B SaaS startup. Our customers are SMEs.
              Your tone should be professional but warm. The most common questions are about
              delivery delays and refunds. When in doubt, always forward the complete case."
            </p>
          </div>

          <textarea
            style={s.textarea}
            value={form.briefing}
            onChange={e => setForm(f => ({ ...f, briefing: e.target.value }))}
            placeholder={`Hi ${agentName}. You work for [company name]...`}
            rows={6}
            autoFocus
          />

          <div style={s.navRow}>
            <span style={s.navHint}>The more context you give, the better {agentName} performs.</span>
            <button
              style={{ ...s.nextBtn, opacity: form.briefing.length < 20 ? 0.4 : 1 }}
              onClick={() => setStep(2)}
              disabled={form.briefing.length < 20}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Access */}
      {step === 2 && (
        <div style={s.content}>
          <p style={s.tag}>ACCESS & PERMISSIONS</p>
          <h1 style={s.title}>Give {agentName} access to the tools it needs.</h1>
          <p style={s.sub}>
            {agentName} will only access what you authorize.<br />
            You can change this at any time from the dashboard.
          </p>

          <div style={s.toolsList}>
            {TOOLS.map(tool => (
              <div
                key={tool.id}
                style={{
                  ...s.toolCard,
                  borderColor: form.tools.includes(tool.id) ? "#c8f03c" : "#1e1e1e",
                  background: form.tools.includes(tool.id) ? "rgba(200,240,60,0.04)" : "#111111",
                }}
              >
                <span style={s.toolIcon}>{tool.icon}</span>
                <div style={s.toolInfo}>
                  <span style={s.toolName}>{tool.name}</span>
                  <span style={s.toolDesc}>{tool.desc}</span>
                </div>
                <button
                  style={{
                    ...s.connectBtn,
                    background: form.tools.includes(tool.id) ? "rgba(200,240,60,0.1)" : "transparent",
                    color: form.tools.includes(tool.id) ? "#c8f03c" : "rgba(240,240,238,0.4)",
                    borderColor: form.tools.includes(tool.id) ? "rgba(200,240,60,0.3)" : "#2a2a2a",
                  }}
                  onClick={() => toggleTool(tool.id)}
                >
                  {form.tools.includes(tool.id) ? "✓ Connected" : "Connect"}
                </button>
              </div>
            ))}
          </div>

          <div style={s.restrictionNote}>
            <span style={s.lockIcon}>—</span>
            <p style={s.restrictionText}>
              {agentName} does <strong>NOT</strong> have access to: Commercial CRM · Agenda · HR files · Bank data
            </p>
          </div>

          <div style={s.navRow}>
            <button style={s.backBtn} onClick={() => setStep(1)}>← Back</button>
            <button style={s.nextBtn} onClick={() => setStep(3)}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 3 — Autonomy */}
      {step === 3 && (
        <div style={s.content}>
          <p style={s.tag}>AUTONOMY RULES</p>
          <h1 style={s.title}>How do you want to start with {agentName}?</h1>

          {/* Mode selector */}
          <div style={s.modesGrid}>
            <button
              style={{
                ...s.modeCard,
                borderColor: form.autonomy_mode === "learning" ? "#c8f03c" : "#1e1e1e",
                background: form.autonomy_mode === "learning" ? "rgba(200,240,60,0.04)" : "#111111",
              }}
              onClick={() => setForm(f => ({ ...f, autonomy_mode: "learning" }))}
            >
              <div style={s.modeTop}>
                <span style={s.modeIcon}>{form.autonomy_mode === "learning" ? "01" : "02"}</span>
                {form.autonomy_mode === "learning" && <span style={s.modeCheck}>✓</span>}
              </div>
              <h3 style={s.modeTitle}>Learning Mode</h3>
              <p style={s.modeDesc}>
                {agentName} asks for confirmation during 7 days, then takes autonomy.
              </p>
              <span style={s.modeBadge}>→ Recommended to start</span>
            </button>

            <button
              style={{
                ...s.modeCard,
                borderColor: form.autonomy_mode === "autonomous" ? "#c8f03c" : "#1e1e1e",
                background: form.autonomy_mode === "autonomous" ? "rgba(200,240,60,0.04)" : "#111111",
              }}
              onClick={() => setForm(f => ({ ...f, autonomy_mode: "autonomous" }))}
            >
              <div style={s.modeTop}>
                <span style={s.modeIcon}>{form.autonomy_mode === "learning" ? "01" : "02"}</span>
                {form.autonomy_mode === "autonomous" && <span style={s.modeCheck}>✓</span>}
              </div>
              <h3 style={s.modeTitle}>Autonomous Mode</h3>
              <p style={s.modeDesc}>
                {agentName} acts directly. You receive a report at end of day.
              </p>
              <span style={s.modeBadge}>→ If you already trust us</span>
            </button>
          </div>

          <p style={s.alwaysNote}>
            In both cases, {agentName} will <strong>always alert you</strong> before spending money or deleting data.
          </p>

          {/* Action rules */}
          <h3 style={s.rulesTitle}>For each action type, define what {agentName} can do alone:</h3>
          <div style={s.rulesList}>
            {[
             { id: "reply_email", icon: "—", label: "Reply to a customer email" },
             { id: "send_followup", icon: "—", label: "Send a follow-up" },
             { id: "offer_discount", icon: "!", label: "Offer a discount or gesture" },
             { id: "escalate", icon: "!!", label: "Escalate to a human" },
            ].map(rule => (
              <div key={rule.id} style={s.ruleRow}>
                <span style={s.ruleIcon}>{rule.icon}</span>
                <span style={s.ruleLabel}>{rule.label}</span>
                <div style={s.ruleOptions}>
                  {rule.id === "escalate" ? (
                    <span style={s.alwaysTag}>Always alert me immediately</span>
                  ) : (
                    <>
                      <button
                        style={{
                          ...s.ruleBtn,
                          background: form.rules[rule.id] === "autonomous" ? "#c8f03c" : "transparent",
                          color: form.rules[rule.id] === "autonomous" ? "#0a0a0b" : "rgba(240,240,238,0.5)",
                          borderColor: form.rules[rule.id] === "autonomous" ? "#c8f03c" : "#2a2a2a",
                        }}
                        onClick={() => setRule(rule.id, "autonomous")}
                      >
                        Autonomous
                      </button>
                      <button
                        style={{
                          ...s.ruleBtn,
                          background: form.rules[rule.id] === "validate" ? "#c8f03c" : "transparent",
                          color: form.rules[rule.id] === "validate" ? "#0a0a0b" : "rgba(240,240,238,0.5)",
                          borderColor: form.rules[rule.id] === "validate" ? "#c8f03c" : "#2a2a2a",
                        }}
                        onClick={() => setRule(rule.id, "validate")}
                      >
                        I validate first
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p style={s.errorText}>{error}</p>}

          <div style={s.navRow}>
            <button style={s.backBtn} onClick={() => setStep(2)}>← Back</button>
            <button
              style={{ ...s.launchBtn, opacity: saving ? 0.7 : 1 }}
              onClick={finish}
              disabled={saving}
            >
              {saving ? "Activating..." : `Activate ${agentName} — it starts working`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0b",
    color: "#f0f0ee",
    fontFamily: "'Inter', sans-serif",
    position: "relative",
  },
  grid: {
    position: "fixed", inset: 0,
    backgroundImage: `linear-gradient(rgba(200,240,60,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200,240,60,0.04) 1px, transparent 1px)`,
    backgroundSize: "60px 60px",
    pointerEvents: "none",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "20px 60px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    position: "relative", zIndex: 1,
  },
  stepIndicator: {
    display: "flex", alignItems: "center", gap: "24px",
  },
  agentLabel: {
    fontSize: "13px", color: "rgba(240,240,238,0.5)",
    fontFamily: "'Inter', sans-serif",
  },
  steps: {
    display: "flex", alignItems: "center", gap: "16px",
  },
  stepItem: {
    display: "flex", alignItems: "center", gap: "6px",
  },
  stepDot: {
    width: "8px", height: "8px", borderRadius: "50%",
    transition: "all 0.3s",
  },
  stepText: {
    fontSize: "12px", fontFamily: "'Inter', sans-serif",
    transition: "color 0.3s",
  },
  stepCount: {
    fontSize: "12px", color: "rgba(240,240,238,0.3)",
    fontFamily: "'Inter', sans-serif",
  },
  content: {
    maxWidth: "680px", margin: "0 auto",
    padding: "60px 24px",
    position: "relative", zIndex: 1,
  },
  tag: {
    fontSize: "11px", letterSpacing: "3px", color: "#c8f03c",
    margin: "0 0 16px 0", fontFamily: "'Inter', sans-serif",
  },
  title: {
    fontSize: "32px", fontWeight: "800", letterSpacing: "-1px",
    margin: "0 0 12px 0", lineHeight: 1.2,
    fontFamily: "'Syne', sans-serif", color: "#f0f0ee",
  },
  sub: {
    fontSize: "14px", color: "rgba(240,240,238,0.4)",
    lineHeight: 1.7, margin: "0 0 28px 0",
    fontFamily: "'Inter', sans-serif",
  },
  exampleBox: {
    background: "#111111", border: "1px solid #1e1e1e",
    borderRadius: "10px", padding: "16px 20px",
    marginBottom: "20px",
  },
  exampleLabel: {
    fontSize: "11px", color: "#c8f03c", margin: "0 0 8px 0",
    fontFamily: "'Inter', sans-serif", letterSpacing: "1px",
  },
  exampleText: {
    fontSize: "13px", color: "rgba(240,240,238,0.5)",
    lineHeight: 1.6, margin: 0, fontStyle: "italic",
    fontFamily: "'Inter', sans-serif",
  },
  textarea: {
    background: "#111111", border: "1px solid #1e1e1e",
    borderRadius: "10px", padding: "16px 18px",
    color: "#f0f0ee", fontSize: "14px", outline: "none",
    resize: "none", fontFamily: "'Inter', sans-serif",
    lineHeight: 1.7, width: "100%", boxSizing: "border-box",
    marginBottom: "20px",
  },
  navRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginTop: "8px",
  },
  navHint: {
    fontSize: "12px", color: "rgba(240,240,238,0.3)",
    fontFamily: "'Inter', sans-serif",
  },
  nextBtn: {
    background: "#c8f03c", color: "#0a0a0b", border: "none",
    borderRadius: "8px", padding: "13px 28px",
    fontSize: "14px", fontWeight: "700", cursor: "pointer",
    fontFamily: "'Syne', sans-serif", transition: "opacity 0.2s",
  },
  backBtn: {
    background: "transparent", border: "none",
    color: "rgba(240,240,238,0.4)", fontSize: "14px",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },
  toolsList: {
    display: "flex", flexDirection: "column", gap: "12px",
    marginBottom: "20px",
  },
  toolCard: {
    background: "#111111", border: "1px solid #1e1e1e",
    borderRadius: "10px", padding: "16px 20px",
    display: "flex", alignItems: "center", gap: "16px",
    transition: "all 0.2s",
  },
  toolIcon: { fontSize: "24px", flexShrink: 0 },
  toolInfo: {
    display: "flex", flexDirection: "column", gap: "2px", flex: 1,
  },
  toolName: {
    fontSize: "14px", fontWeight: "600", color: "#f0f0ee",
    fontFamily: "'Syne', sans-serif",
  },
  toolDesc: {
    fontSize: "12px", color: "rgba(240,240,238,0.4)",
    fontFamily: "'Inter', sans-serif",
  },
  connectBtn: {
    border: "1px solid", borderRadius: "8px",
    padding: "8px 16px", fontSize: "12px", fontWeight: "600",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    flexShrink: 0, transition: "all 0.2s",
  },
  restrictionNote: {
    display: "flex", alignItems: "flex-start", gap: "10px",
    background: "rgba(255,255,255,0.02)", border: "1px solid #1e1e1e",
    borderRadius: "8px", padding: "12px 16px", marginBottom: "24px",
  },
  lockIcon: { fontSize: "16px", flexShrink: 0 },
  restrictionText: {
    fontSize: "12px", color: "rgba(240,240,238,0.4)",
    lineHeight: 1.5, margin: 0, fontFamily: "'Inter', sans-serif",
  },
  modesGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "16px", marginBottom: "20px",
  },
  modeCard: {
    background: "#111111", border: "1px solid #1e1e1e",
    borderRadius: "12px", padding: "20px",
    cursor: "pointer", textAlign: "left",
    display: "flex", flexDirection: "column", gap: "8px",
    transition: "all 0.2s",
  },
  modeTop: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  modeIcon: { fontSize: "20px", color: "#c8f03c", fontWeight: "700" },
  modeCheck: { color: "#c8f03c", fontSize: "16px", fontWeight: "700" },
  modeTitle: {
    fontSize: "16px", fontWeight: "700", margin: 0,
    fontFamily: "'Syne', sans-serif", color: "#f0f0ee",
  },
  modeDesc: {
    fontSize: "13px", color: "rgba(240,240,238,0.4)",
    lineHeight: 1.5, margin: 0, fontFamily: "'Inter', sans-serif",
  },
  modeBadge: {
    fontSize: "11px", color: "#c8f03c",
    fontFamily: "'Inter', sans-serif",
  },
  alwaysNote: {
    fontSize: "13px", color: "rgba(240,240,238,0.5)",
    background: "rgba(200,240,60,0.04)", border: "1px solid rgba(200,240,60,0.15)",
    borderRadius: "8px", padding: "12px 16px",
    margin: "0 0 28px 0", lineHeight: 1.5,
    fontFamily: "'Inter', sans-serif",
  },
  rulesTitle: {
    fontSize: "13px", fontWeight: "600", margin: "0 0 16px 0",
    color: "rgba(240,240,238,0.6)", fontFamily: "'Inter', sans-serif",
  },
  rulesList: {
    display: "flex", flexDirection: "column", gap: "10px",
    marginBottom: "28px",
  },
  ruleRow: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "#111111", border: "1px solid #1e1e1e",
    borderRadius: "8px", padding: "12px 16px",
  },
  ruleIcon: { fontSize: "18px", flexShrink: 0 },
  ruleLabel: {
    flex: 1, fontSize: "13px", color: "#f0f0ee",
    fontFamily: "'Inter', sans-serif",
  },
  ruleOptions: { display: "flex", gap: "8px" },
  ruleBtn: {
    border: "1px solid", borderRadius: "6px",
    padding: "6px 12px", fontSize: "11px", fontWeight: "600",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    transition: "all 0.15s",
  },
  alwaysTag: {
    fontSize: "11px", color: "#f87171",
    fontFamily: "'Inter', sans-serif", fontWeight: "600",
  },
  errorText: {
    fontSize: "13px", color: "#f87171",
    background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: "8px", padding: "12px 16px",
    margin: "0 0 16px 0", fontFamily: "'Inter', sans-serif",
  },
  launchBtn: {
    background: "#c8f03c", color: "#0a0a0b", border: "none",
    borderRadius: "8px", padding: "14px 28px",
    fontSize: "14px", fontWeight: "700", cursor: "pointer",
    fontFamily: "'Syne', sans-serif", transition: "opacity 0.2s",
  },
};