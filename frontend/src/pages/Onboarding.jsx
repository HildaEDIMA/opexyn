import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

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

const STEPS = [
  { id: 1, label: "Your business" },
  { id: 2, label: "Your challenge" },
  { id: 3, label: "Your tools" },
];

// Challenge → role technique (clé utilisée côté backend dans AGENT_ROLES).
// "all" a été retiré : on ne peut déployer qu'un poste à la fois pour l'instant.
const CHALLENGES = [
  { id: "customer_support", icon: "💬", title: "Respond to customers faster", desc: "Emails, messages, tickets piling up" },
  { id: "sales_development", icon: "📈", title: "Follow up on prospects", desc: "Leads going cold, no time to follow up" },
  { id: "ops_admin", icon: "🗂️", title: "Manage my admin work", desc: "Scheduling, documents, reporting" },
];

const TOOLS = [
  "Gmail", "Outlook", "WhatsApp Business",
  "HubSpot", "Pipedrive", "Salesforce",
  "Notion", "Google Drive", "Slack",
  "Calendly", "Stripe", "Other",
];

const ROLE_ICON = {
  customer_support: "💬",
  sales_development: "📈",
  ops_admin: "🗂️",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_description: "",
    challenge: "",
    tools: [],
  });
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState({});

  useEffect(() => {
    api.get("/billing/roles").then(res => setRoles(res.data)).catch(console.error);
  }, []);

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const toggleTool = (tool) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(tool)
        ? f.tools.filter(t => t !== tool)
        : [...f.tools, tool]
    }));
  };

  const finish = async () => {
    setSaving(true);
    try {
      await api.put("/client/context", {
        business_description: form.business_description,
        business_priorities: `Main challenge: ${form.challenge}. Tools used: ${form.tools.join(", ")}`,
        short_term_goals: "",
        long_term_goals: "",
      });
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
    setStep(4);
  };

  const goToMarketplace = (roleKey) => {
    navigate("/marketplace", { state: { preselectedRole: roleKey } });
  };

  const recommendedRoleKey = form.challenge || "customer_support";
  const recommendedRole = roles[recommendedRoleKey];

  return (
    <div style={s.page}>
      <div style={s.grid} />

      {/* Step 1 — Business description */}
      {step === 1 && (
        <div style={s.screen}>
          <div style={s.topBar}>
            <Logo />
            <div style={s.progress}>
              {STEPS.map((st, i) => (
                <div key={st.id} style={{
                  ...s.progressStep,
                  background: step >= st.id ? "#c8f03c" : "#1e1e1e",
                }} />
              ))}
              <span style={s.progressLabel}>Step 1/3</span>
            </div>
          </div>

          <div style={s.content}>
            <p style={s.stepTag}>YOUR BUSINESS</p>
            <h1 style={s.bigQuestion}>Tell us about your company.</h1>
            <p style={s.hint}>Write naturally. No need to be precise.</p>

            <textarea
              style={s.bigTextarea}
              value={form.business_description}
              onChange={e => setForm(f => ({ ...f, business_description: e.target.value }))}
              placeholder={`e.g. "We sell B2B software, 15 people, lots of support tickets by email..."`}
              rows={5}
              autoFocus
            />

            <button
              style={{ ...s.continueBtn, opacity: form.business_description.length < 10 ? 0.4 : 1 }}
              onClick={next}
              disabled={form.business_description.length < 10}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Challenge */}
      {step === 2 && (
        <div style={s.screen}>
          <div style={s.topBar}>
            <Logo />
            <div style={s.progress}>
              {STEPS.map((st) => (
                <div key={st.id} style={{
                  ...s.progressStep,
                  background: step >= st.id ? "#c8f03c" : "#1e1e1e",
                }} />
              ))}
              <span style={s.progressLabel}>Step 2/3</span>
            </div>
          </div>

          <div style={s.content}>
            <p style={s.stepTag}>YOUR CHALLENGE</p>
            <h1 style={s.bigQuestion}>What's your biggest operational challenge right now?</h1>

            <div style={s.choicesGrid}>
              {CHALLENGES.map(c => (
                <button
                  key={c.id}
                  style={{
                    ...s.choiceBtn,
                    borderColor: form.challenge === c.id ? "#c8f03c" : "#1e1e1e",
                    background: form.challenge === c.id ? "rgba(200,240,60,0.06)" : "#111111",
                  }}
                  onClick={() => setForm(f => ({ ...f, challenge: c.id }))}
                >
                  <span style={s.choiceIcon}>{c.icon}</span>
                  <span style={s.choiceTitle}>{c.title}</span>
                  <span style={s.choiceDesc}>{c.desc}</span>
                  {form.challenge === c.id && (
                    <span style={s.choiceCheck}>✓</span>
                  )}
                </button>
              ))}
            </div>

            <div style={s.navRow}>
              <button style={s.backBtn} onClick={back}>← Back</button>
              <button
                style={{ ...s.continueBtn, opacity: !form.challenge ? 0.4 : 1 }}
                onClick={next}
                disabled={!form.challenge}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Tools */}
      {step === 3 && (
        <div style={s.screen}>
          <div style={s.topBar}>
            <Logo />
            <div style={s.progress}>
              {STEPS.map((st) => (
                <div key={st.id} style={{
                  ...s.progressStep,
                  background: step >= st.id ? "#c8f03c" : "#1e1e1e",
                }} />
              ))}
              <span style={s.progressLabel}>Step 3/3</span>
            </div>
          </div>

          <div style={s.content}>
            <p style={s.stepTag}>YOUR TOOLS</p>
            <h1 style={s.bigQuestion}>Which tools do you already use?</h1>
            <p style={s.hint}>Select all that apply.</p>

            <div style={s.toolsGrid}>
              {TOOLS.map(tool => (
                <button
                  key={tool}
                  style={{
                    ...s.toolBtn,
                    borderColor: form.tools.includes(tool) ? "#c8f03c" : "#1e1e1e",
                    background: form.tools.includes(tool) ? "rgba(200,240,60,0.06)" : "#111111",
                    color: form.tools.includes(tool) ? "#c8f03c" : "rgba(240,240,238,0.6)",
                  }}
                  onClick={() => toggleTool(tool)}
                >
                  {form.tools.includes(tool) && <span style={{ marginRight: "6px" }}>✓</span>}
                  {tool}
                </button>
              ))}
            </div>

            <div style={s.navRow}>
              <button style={s.backBtn} onClick={back}>← Back</button>
              <button
                style={{ ...s.continueBtn, opacity: saving ? 0.7 : 1 }}
                onClick={finish}
                disabled={saving}
              >
                {saving ? "Saving..." : "See my recommended role →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Recommended role */}
      {step === 4 && (
        <div style={s.screen}>
          <div style={s.topBar}>
            <Logo />
          </div>

          <div style={s.content}>
            <p style={s.stepTag}>YOUR AI WORKFORCE</p>
            <h1 style={s.bigQuestion}>Based on your profile, here's the role we recommend.</h1>

            <div style={s.agentsStack}>
              {/* Recommended role */}
              <div style={s.agentCardMain}>
                <div style={s.agentCardTop}>
                  <span style={s.agentIcon}>{ROLE_ICON[recommendedRoleKey] || "⚙️"}</span>
                  <div>
                    <h3 style={s.agentCardName}>
                      {recommendedRole?.display_name || "AI Employee"}
                    </h3>
                    <p style={s.agentCardRole}>You'll choose its name next</p>
                  </div>
                </div>
                <p style={s.agentCardDesc}>
                  {recommendedRole?.description || "Works autonomously to cover this part of your operations."}
                </p>
                <button
                  style={s.deployPrimaryBtn}
                  onClick={() => goToMarketplace(recommendedRoleKey)}
                >
                  Deploy this role — recommended
                </button>
              </div>

              {/* Other roles */}
              <div style={s.otherAgents}>
                {Object.entries(roles)
                  .filter(([key]) => key !== recommendedRoleKey)
                  .map(([key, role]) => (
                    <div key={key} style={s.agentCardSmall}>
                      <div style={s.agentCardTop}>
                        <span style={s.agentIconSmall}>{ROLE_ICON[key] || "⚙️"}</span>
                        <div>
                          <h3 style={{ ...s.agentCardName, fontSize: "15px" }}>{role.display_name}</h3>
                          <p style={s.agentCardRole}>AI Employee</p>
                        </div>
                        {key !== "customer_support" && <span style={s.soonBadge}>Soon</span>}
                      </div>
                      <p style={{ ...s.agentCardDesc, fontSize: "12px" }}>{role.description}</p>
                    </div>
                  ))}
              </div>
            </div>

            <div style={s.navRow}>
              <button style={s.skipBtn} onClick={() => navigate("/dashboard")}>
                Skip for now
              </button>
              <button style={s.deployPrimaryBtn} onClick={() => goToMarketplace(recommendedRoleKey)}>
                Deploy your first AI employee →
              </button>
            </div>
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
    overflow: "hidden",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(200,240,60,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200,240,60,0.04) 1px, transparent 1px)
    `,
    backgroundSize: "60px 60px",
    pointerEvents: "none",
  },
  screen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    zIndex: 1,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 60px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  progress: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  progressStep: {
    width: "32px",
    height: "4px",
    borderRadius: "2px",
    transition: "background 0.3s",
  },
  progressLabel: {
    fontSize: "12px",
    color: "rgba(240,240,238,0.3)",
    marginLeft: "8px",
  },
  content: {
    maxWidth: "680px",
    margin: "0 auto",
    padding: "60px 24px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  stepTag: {
    fontSize: "11px",
    letterSpacing: "3px",
    color: "#c8f03c",
    margin: "0 0 16px 0",
  },
  bigQuestion: {
    fontSize: "32px",
    fontWeight: "800",
    letterSpacing: "-1px",
    margin: "0 0 12px 0",
    lineHeight: 1.2,
    fontFamily: "'Syne', sans-serif",
  },
  hint: {
    fontSize: "14px",
    color: "rgba(240,240,238,0.4)",
    margin: "0 0 28px 0",
  },
  bigTextarea: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "10px",
    padding: "16px 18px",
    color: "#f0f0ee",
    fontSize: "15px",
    outline: "none",
    resize: "none",
    fontFamily: "'Inter', sans-serif",
    lineHeight: 1.7,
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "24px",
  },
  continueBtn: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "14px 28px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
    alignSelf: "flex-start",
    transition: "opacity 0.2s",
  },
  choicesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "14px",
    marginBottom: "28px",
  },
  choiceBtn: {
    background: "#111111",
    border: "1px solid",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    cursor: "pointer",
    textAlign: "left",
    position: "relative",
    transition: "all 0.2s",
  },
  choiceIcon: { fontSize: "24px" },
  choiceTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#f0f0ee",
    fontFamily: "'Syne', sans-serif",
  },
  choiceDesc: {
    fontSize: "12px",
    color: "rgba(240,240,238,0.4)",
  },
  choiceCheck: {
    position: "absolute",
    top: "16px",
    right: "16px",
    color: "#c8f03c",
    fontWeight: "700",
  },
  navRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "8px",
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(240,240,238,0.4)",
    fontSize: "14px",
    cursor: "pointer",
  },
  toolsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginBottom: "28px",
  },
  toolBtn: {
    background: "#111111",
    border: "1px solid",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "all 0.15s",
  },
  agentsStack: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "28px",
  },
  agentCardMain: {
    background: "#111111",
    border: "1px solid #c8f03c",
    borderRadius: "14px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  agentCardTop: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  agentIcon: { fontSize: "28px" },
  agentIconSmall: { fontSize: "20px" },
  agentCardName: {
    fontSize: "18px",
    fontWeight: "700",
    margin: 0,
    fontFamily: "'Syne', sans-serif",
  },
  agentCardRole: {
    fontSize: "12px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
  },
  agentCardDesc: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.5)",
    lineHeight: 1.6,
    margin: 0,
  },
  deployPrimaryBtn: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "13px 24px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
    alignSelf: "flex-start",
  },
  otherAgents: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  agentCardSmall: {
    background: "#0d0d0d",
    border: "1px solid #1e1e1e",
    borderRadius: "10px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  soonBadge: {
    marginLeft: "auto",
    fontSize: "10px",
    color: "rgba(240,240,238,0.3)",
    background: "#1a1a1a",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  skipBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(240,240,238,0.3)",
    fontSize: "13px",
    cursor: "pointer",
  },
};