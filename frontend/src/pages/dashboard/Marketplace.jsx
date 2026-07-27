import { useState, useEffect } from "react";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

const PLANS = [
  { name: "Discovery", price: 149, planKey: "discovery", tickets: 100, duration: "1 month trial" },
  { name: "Startup", price: 399, planKey: "startup", tickets: 200, duration: "monthly" },
  { name: "Growth", price: 699, planKey: "growth", tickets: 500, duration: "monthly" },
];

export default function Marketplace() {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [agentName, setAgentName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/agent/templates");
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedPlan || !agentName.trim()) return;
    setLoading(true);
    try {
      const res = await api.post(`/billing/checkout/${selectedPlan.planKey}`, {
        template_id: selectedTemplate.id,
        agent_name: agentName.trim(),
      });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      {/* Sidebar */}
      <Sidebar active="Marketplace" />

      {/* Main */}
      <div style={s.main}>
        {!selectedTemplate ? (
          <>
            <div style={s.header}>
              <p style={s.tag}>AI WORKFORCE</p>
              <h2 style={s.headerTitle}>Marketplace</h2>
              <p style={s.headerSub}>
                Deploy specialized AI employees to run your business operations.
                Each agent is trained for their role and works autonomously 24/7.
              </p>
            </div>

            {loadingTemplates ? (
              <p style={{ color: "rgba(240,240,238,0.4)", fontSize: 13 }}>Loading available roles...</p>
            ) : templates.length === 0 ? (
              <p style={{ color: "rgba(240,240,238,0.4)", fontSize: 13 }}>No roles available yet.</p>
            ) : (
              <div style={s.agentsGrid}>
                {templates.map(template => (
                  <div key={template.id} style={s.agentCard}>
                    <div style={s.agentTop}>
                      <div style={s.agentAvatar}>
                        {template.display_name.charAt(0)}
                      </div>
                      <div>
                        <h3 style={s.agentName}>{template.display_name}</h3>
                        <p style={s.agentRole}>{template.role}</p>
                      </div>
                    </div>

                    <p style={s.agentDesc}>{template.description || "No description provided."}</p>

                    <button
                      style={s.deployBtn}
                      onClick={() => { setSelectedTemplate(template); setAgentName(""); setSelectedPlan(null); }}
                    >
                      Deploy {template.display_name} →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Configuration view: nom de l'agent + plan */
          <div style={s.planView}>
            <button
              style={s.backBtn}
              onClick={() => { setSelectedTemplate(null); setSelectedPlan(null); setAgentName(""); }}
            >
              ← Back to Marketplace
            </button>

            <div style={s.planHeader}>
              <div style={s.planAgentAvatar}>{selectedTemplate.display_name.charAt(0)}</div>
              <div>
                <h2 style={s.planTitle}>Deploy your {selectedTemplate.display_name}</h2>
                <p style={s.planSub}>{selectedTemplate.description}</p>
              </div>
            </div>

            <p style={s.planQuestion}>Give your AI employee a name:</p>
            <input
              style={s.nameInput}
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="e.g. Alex, Sam, Nova..."
              maxLength={30}
            />

            <p style={{ ...s.planQuestion, marginTop: 28 }}>Choose a plan:</p>

            <div style={s.plansGrid}>
              {PLANS.map((plan, i) => (
                <div
                  key={i}
                  style={{
                    ...s.planCard,
                    borderColor: selectedPlan?.planKey === plan.planKey ? "#c8f03c" : "#1e1e1e",
                    background: selectedPlan?.planKey === plan.planKey ? "rgba(200,240,60,0.04)" : "#111111",
                  }}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <h3 style={s.planName}>{plan.name}</h3>
                  <div style={s.planPrice}>
                    <span style={s.planCurrency}>$</span>
                    <span style={s.planAmount}>{plan.price}</span>
                    <span style={s.planPer}>/mo</span>
                  </div>
                  <p style={s.planDuration}>{plan.duration}</p>
                  <div style={s.planFeature}>
                    <span style={{ color: "#c8f03c" }}>—</span>
                    {plan.tickets}+ actions/day
                  </div>
                  {selectedPlan?.planKey === plan.planKey && (
                    <div style={s.selectedCheck}>Selected</div>
                  )}
                </div>
              ))}
            </div>

            <div style={s.deployRow}>
              <div>
                {selectedPlan && agentName.trim() && (
                  <p style={s.selectedSummary}>
                    {agentName.trim()} — {selectedTemplate.display_name} — {selectedPlan.name} plan — ${selectedPlan.price}/mo
                  </p>
                )}
              </div>
              <button
                style={{
                  ...s.confirmBtn,
                  opacity: !selectedPlan || !agentName.trim() || loading ? 0.4 : 1,
                }}
                disabled={!selectedPlan || !agentName.trim() || loading}
                onClick={handleDeploy}
              >
                {loading ? "Redirecting..." : `Deploy →`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { display: "flex", minHeight: "100vh", background: "#0a0a0b", fontFamily: "'Inter', sans-serif", color: "#f0f0ee" },
  main: { marginLeft: "240px", flex: 1, padding: "48px 40px", boxSizing: "border-box" },
  header: { marginBottom: "36px" },
  tag: { fontSize: "11px", letterSpacing: "3px", color: "#c8f03c", margin: "0 0 12px 0" },
  headerTitle: { fontSize: "28px", fontWeight: "800", margin: "0 0 8px 0", fontFamily: "'Syne', sans-serif", letterSpacing: "-1px" },
  headerSub: { fontSize: "13px", color: "rgba(240,240,238,0.4)", margin: 0, lineHeight: 1.7, maxWidth: "600px" },
  agentsGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" },
  agentCard: { background: "#111111", border: "1px solid #1e1e1e", borderRadius: "14px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", position: "relative" },
  agentTop: { display: "flex", alignItems: "center", gap: "12px" },
  agentAvatar: { width: "44px", height: "44px", background: "#c8f03c", color: "#0a0a0b", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", flexShrink: 0, fontFamily: "'Syne', sans-serif", textTransform: "uppercase" },
  agentName: { fontSize: "18px", fontWeight: "700", margin: "0 0 2px 0", fontFamily: "'Syne', sans-serif" },
  agentRole: { fontSize: "12px", color: "rgba(240,240,238,0.4)", margin: 0, textTransform: "capitalize" },
  agentDesc: { fontSize: "13px", color: "rgba(240,240,238,0.5)", lineHeight: 1.6, margin: 0 },
  deployBtn: { background: "#c8f03c", color: "#0a0a0b", border: "none", borderRadius: "8px", padding: "12px", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Syne', sans-serif", marginTop: "auto" },
  planView: { maxWidth: "900px" },
  backBtn: { background: "transparent", border: "none", color: "rgba(240,240,238,0.4)", fontSize: "13px", cursor: "pointer", marginBottom: "32px", padding: 0 },
  planHeader: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" },
  planAgentAvatar: { width: "56px", height: "56px", background: "#c8f03c", color: "#0a0a0b", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "800", flexShrink: 0, fontFamily: "'Syne', sans-serif", textTransform: "uppercase" },
  planTitle: { fontSize: "26px", fontWeight: "800", margin: "0 0 4px 0", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.5px" },
  planSub: { fontSize: "13px", color: "rgba(240,240,238,0.4)", margin: 0 },
  planQuestion: { fontSize: "14px", color: "rgba(240,240,238,0.5)", margin: "0 0 12px 0" },
  nameInput: { background: "#111111", border: "1px solid #1e1e1e", borderRadius: "8px", padding: "12px 16px", color: "#f0f0ee", fontSize: "14px", outline: "none", width: "100%", maxWidth: "320px", boxSizing: "border-box", fontFamily: "'Inter', sans-serif" },
  plansGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" },
  planCard: { background: "#111111", border: "1px solid", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", position: "relative", cursor: "pointer", transition: "all 0.2s" },
  planName: { fontSize: "16px", fontWeight: "700", margin: 0, fontFamily: "'Syne', sans-serif" },
  planPrice: { display: "flex", alignItems: "baseline", gap: "2px" },
  planCurrency: { fontSize: "16px", color: "rgba(240,240,238,0.5)" },
  planAmount: { fontSize: "36px", fontWeight: "800", fontFamily: "'Syne', sans-serif", letterSpacing: "-1px" },
  planPer: { fontSize: "12px", color: "rgba(240,240,238,0.4)" },
  planDuration: { fontSize: "11px", color: "rgba(240,240,238,0.3)", margin: 0 },
  planFeature: { fontSize: "12px", color: "rgba(240,240,238,0.5)", display: "flex", gap: "8px", alignItems: "center" },
  selectedCheck: { fontSize: "11px", color: "#c8f03c", fontWeight: "600", textAlign: "center", marginTop: "4px" },
  deployRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111111", border: "1px solid #1e1e1e", borderRadius: "10px", padding: "16px 20px" },
  selectedSummary: { fontSize: "13px", color: "rgba(240,240,238,0.5)", margin: 0 },
  confirmBtn: { background: "#c8f03c", color: "#0a0a0b", border: "none", borderRadius: "8px", padding: "12px 28px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Syne', sans-serif", transition: "opacity 0.2s" },
};