import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const Logo = ({ size = "default" }) => (
  <svg width={size === "small" ? 160 : 220} viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg">
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

const HexIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <polygon points="24,3 40,12 40,36 24,45 8,36 8,12" fill="none" stroke="#c8f03c" strokeWidth="1.5"/>
    <polygon points="24,10 34,16 34,32 24,38 14,32 14,16" fill="#c8f03c"/>
    <polygon points="24,17 29,20 29,28 24,31 19,28 19,20" fill="#0a0a0b"/>
  </svg>
);

export default function Landing() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { num: "01", title: "Describe your business", desc: "Tell us what your company does, your priorities, and your goals. Takes 5 minutes." },
    { num: "02", title: "Deploy your AI employee", desc: "Choose from our specialized agents. Alex handles support. More coming." },
    { num: "03", title: "Watch them work", desc: "Your AI employee starts immediately. 24/7, no sick days, no turnover." },
  ];

  const agents = [
    {
      name: "Alex",
      role: "Customer Support",
      status: "available",
      desc: "Handles emails, WhatsApp, and Instagram DMs. Responds in minutes, generates daily reports.",
      skills: ["Email", "WhatsApp", "Instagram", "Daily Reports"],
      metric: "100+ tickets/day",
    },
    {
      name: "Morgan",
      role: "Sales Development",
      status: "soon",
      desc: "Qualifies leads, books meetings, follows up on prospects autonomously.",
      skills: ["LinkedIn", "Cold Email", "CRM", "Lead Scoring"],
      metric: "50+ outreaches/day",
    },
    {
      name: "Riley",
      role: "Operations",
      status: "soon",
      desc: "Manages schedules, coordinates teams, handles internal workflows.",
      skills: ["Scheduling", "Slack", "Notion", "Reporting"],
      metric: "Always on",
    },
  ];

  const plans = [
    {
      name: "Discovery",
      price: "149",
      period: "one month",
      desc: "Test the full power of an AI employee — no commitment.",
      features: ["1 AI employee", "100 tickets/day", "Email + WhatsApp", "Daily reports", "24/7 autonomous"],
      highlight: false,
      cta: "Start free trial",
    },
    {
      name: "Startup",
      price: "399",
      period: "per agent / month",
      desc: "Commit for 3 months and scale your AI workforce.",
      features: ["Up to 3 AI employees", "200 tickets/day per agent", "All channels", "Advanced analytics", "Priority support"],
      highlight: true,
      cta: "Get started",
      badge: "Most popular",
    },
    {
      name: "Growth",
      price: "699",
      period: "per agent / month",
      desc: "Unlimited AI employees for fast-scaling teams.",
      features: ["Unlimited AI employees", "500 tickets/day per agent", "All channels", "Custom integrations", "Dedicated support"],
      highlight: false,
      cta: "Get started",
    },
  ];

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <Logo size="small" />
        <div style={s.navLinks}>
          <span style={s.navLink} onClick={() => document.getElementById('agents')?.scrollIntoView({behavior:'smooth'})}>Agents</span>
          <span style={s.navLink} onClick={() => document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})}>Pricing</span>
          <span style={s.navLink}>Docs</span>
        </div>
        <div style={s.navActions}>
          <button style={s.navLoginBtn} onClick={() => navigate("/login")}>Sign in</button>
          <button style={s.navCtaBtn} onClick={() => navigate("/register")}>Get early access →</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={s.hero} ref={heroRef}>
        <div style={s.betaBadge}>
          <span style={s.betaDot} />
          NOW IN PRIVATE BETA
        </div>

        <h1 style={s.heroTitle}>
          Your first<br />
          <span style={s.heroAccent}>AI workforce.</span>
        </h1>

        <p style={s.heroSub}>
          Deploy specialized AI employees to run your business<br />
          operations end-to-end — support, sales, HR, ops —<br />
          without the overhead.
        </p>

        <div style={s.heroCtas}>
          <button style={s.heroPrimaryBtn} onClick={() => navigate("/register")}>
            Deploy your first agent →
          </button>
          <button
            style={s.heroSecondaryBtn}
            onClick={() => document.getElementById('how')?.scrollIntoView({behavior:'smooth'})}
          >
            See how it works ↓
          </button>
        </div>

        <div style={s.heroMetrics}>
          {[
            { value: "24/7", label: "Always on, never off" },
            { value: "<5min", label: "Time to first deployment" },
            { value: "∞", label: "Scale without hiring" },
          ].map((m, i) => (
            <div key={i} style={s.heroMetric}>
              <span style={s.heroMetricValue}>{m.value}</span>
              <span style={s.heroMetricLabel}>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Grid background */}
        <div style={s.heroGrid} />
      </section>

      {/* How it works */}
      <section id="how" style={s.section}>
        <div style={s.sectionInner}>
          <p style={s.sectionTag}>HOW IT WORKS</p>
          <h2 style={s.sectionTitle}>Up and running in minutes</h2>
          <div style={s.steps}>
            {steps.map((step, i) => (
              <div
                key={i}
                style={{
                  ...s.step,
                  borderColor: activeStep === i ? "#c8f03c" : "#1e1e1e",
                  background: activeStep === i ? "rgba(200,240,60,0.04)" : "#111111",
                }}
              >
                <span style={s.stepNum}>{step.num}</span>
                <h3 style={s.stepTitle}>{step.title}</h3>
                <p style={s.stepDesc}>{step.desc}</p>
                {activeStep === i && <div style={s.stepActive} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents */}
      <section id="agents" style={s.section}>
        <div style={s.sectionInner}>
          <p style={s.sectionTag}>AI EMPLOYEES</p>
          <h2 style={s.sectionTitle}>Meet your new team</h2>
          <p style={s.sectionSub}>
            Each agent is a fully autonomous professional — trained for their role,<br />
            connected to your tools, working around the clock.
          </p>
          <div style={s.agentsGrid}>
            {agents.map((agent, i) => (
              <div
                key={i}
                style={{
                  ...s.agentCard,
                  opacity: agent.status === "soon" ? 0.5 : 1,
                  border: agent.status === "available" ? "1px solid #c8f03c" : "1px solid #1e1e1e",
                }}
              >
                {agent.status === "soon" && (
                  <div style={s.soonBadge}>Coming soon</div>
                )}
                <div style={s.agentTop}>
                  <HexIcon size={40} />
                  <div>
                    <h3 style={s.agentName}>{agent.name}</h3>
                    <p style={s.agentRole}>{agent.role}</p>
                  </div>
                  <span style={s.agentMetric}>{agent.metric}</span>
                </div>
                <p style={s.agentDesc}>{agent.desc}</p>
                <div style={s.agentSkills}>
                  {agent.skills.map((skill, j) => (
                    <span key={j} style={s.skill}>{skill}</span>
                  ))}
                </div>
                {agent.status === "available" && (
                  <button style={s.agentBtn} onClick={() => navigate("/register")}>
                    Deploy Alex →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section style={s.proofSection}>
        <div style={s.sectionInner}>
          <div style={s.proofGrid}>
            {[
              { value: "$3,500/mo", label: "Average cost of a human support agent" },
              { value: "$149/mo", label: "Cost of Alex — your AI support employee" },
              { value: "95%", label: "Cost reduction without sacrificing quality" },
            ].map((p, i) => (
              <div key={i} style={s.proofItem}>
                <span style={{
                  ...s.proofValue,
                  color: i === 1 ? "#c8f03c" : i === 2 ? "#c8f03c" : "#f87171"
                }}>
                  {p.value}
                </span>
                <span style={s.proofLabel}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={s.section}>
        <div style={s.sectionInner}>
          <p style={s.sectionTag}>PRICING</p>
          <h2 style={s.sectionTitle}>Simple, transparent pricing</h2>
          <p style={s.sectionSub}>
            Start with a one-month trial. No hidden fees, no surprises.
          </p>
          <div style={s.plansGrid}>
            {plans.map((plan, i) => (
              <div
                key={i}
                style={{
                  ...s.planCard,
                  border: plan.highlight ? "1px solid #c8f03c" : "1px solid #1e1e1e",
                  background: plan.highlight ? "rgba(200,240,60,0.04)" : "#111111",
                }}
              >
                {plan.badge && <div style={s.planBadge}>{plan.badge}</div>}
                <h3 style={s.planName}>{plan.name}</h3>
                <p style={s.planDesc}>{plan.desc}</p>
                <div style={s.planPrice}>
                  <span style={s.planCurrency}>$</span>
                  <span style={s.planAmount}>{plan.price}</span>
                </div>
                <p style={s.planPeriod}>{plan.period}</p>
                <ul style={s.planFeatures}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={s.planFeature}>
                      <span style={{ color: "#c8f03c", marginRight: "8px" }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  style={{
                    ...s.planBtn,
                    background: plan.highlight ? "#c8f03c" : "transparent",
                    color: plan.highlight ? "#0a0a0b" : "#ffffff",
                    border: plan.highlight ? "none" : "1px solid #333",
                  }}
                  onClick={() => navigate("/register")}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={s.ctaSection}>
        <div style={s.sectionInner}>
          <div style={s.ctaBox}>
            <HexIcon size={64} />
            <h2 style={s.ctaTitle}>
              Ready to hire your<br />
              <span style={s.heroAccent}>first AI employee?</span>
            </h2>
            <p style={s.ctaSub}>
              Join the companies already running on Opexyn.<br />
              Deploy in under 5 minutes.
            </p>
            <button style={s.heroPrimaryBtn} onClick={() => navigate("/register")}>
              Get started for $149 →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <Logo size="small" />
          <p style={s.footerText}>© 2025 Opexyn. Your first AI workforce.</p>
          <div style={s.footerLinks}>
            <span style={s.footerLink}>Privacy</span>
            <span style={s.footerLink}>Terms</span>
            <span style={s.footerLink}>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const s = {
  page: {
    background: "#0a0a0b",
    color: "#f0f0ee",
    fontFamily: "'Syne', 'Inter', sans-serif",
    minHeight: "100vh",
    overflowX: "hidden",
  },

  // Nav
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 60px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    position: "sticky",
    top: 0,
    background: "rgba(10,10,11,0.95)",
    backdropFilter: "blur(10px)",
    zIndex: 100,
  },
  navLinks: {
    display: "flex",
    gap: "40px",
  },
  navLink: {
    fontSize: "14px",
    color: "rgba(240,240,238,0.6)",
    cursor: "pointer",
    transition: "color 0.2s",
  },
  navActions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  navLoginBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(240,240,238,0.6)",
    fontSize: "14px",
    cursor: "pointer",
    padding: "8px 16px",
  },
  navCtaBtn: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
  },

  // Hero
  hero: {
    padding: "120px 60px 100px",
    position: "relative",
    overflow: "hidden",
  },
  heroGrid: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `
      linear-gradient(rgba(200,240,60,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200,240,60,0.04) 1px, transparent 1px)
    `,
    backgroundSize: "60px 60px",
    zIndex: 0,
    pointerEvents: "none",
  },
  betaBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(200,240,60,0.08)",
    border: "1px solid rgba(200,240,60,0.2)",
    borderRadius: "4px",
    padding: "6px 14px",
    fontSize: "11px",
    letterSpacing: "2px",
    color: "#c8f03c",
    marginBottom: "40px",
    position: "relative",
    zIndex: 1,
  },
  betaDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#c8f03c",
  },
  heroTitle: {
    fontSize: "80px",
    fontWeight: "800",
    lineHeight: 1.05,
    letterSpacing: "-2px",
    margin: "0 0 24px 0",
    position: "relative",
    zIndex: 1,
    fontFamily: "'Syne', sans-serif",
  },
  heroAccent: {
    color: "#c8f03c",
  },
  heroSub: {
    fontSize: "18px",
    lineHeight: 1.7,
    color: "rgba(240,240,238,0.55)",
    margin: "0 0 48px 0",
    position: "relative",
    zIndex: 1,
    fontFamily: "'Inter', sans-serif",
    fontWeight: "400",
  },
  heroCtas: {
    display: "flex",
    gap: "20px",
    alignItems: "center",
    marginBottom: "80px",
    position: "relative",
    zIndex: 1,
  },
  heroPrimaryBtn: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "16px 32px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
  },
  heroSecondaryBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(240,240,238,0.6)",
    fontSize: "15px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  heroMetrics: {
    display: "flex",
    gap: "64px",
    position: "relative",
    zIndex: 1,
  },
  heroMetric: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  heroMetricValue: {
    fontSize: "36px",
    fontWeight: "800",
    color: "#c8f03c",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-1px",
  },
  heroMetricLabel: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    fontFamily: "'Inter', sans-serif",
  },

  // Sections
  section: {
    padding: "100px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  sectionInner: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 60px",
  },
  sectionTag: {
    fontSize: "11px",
    letterSpacing: "3px",
    color: "#c8f03c",
    margin: "0 0 16px 0",
    fontFamily: "'Inter', sans-serif",
  },
  sectionTitle: {
    fontSize: "48px",
    fontWeight: "800",
    letterSpacing: "-1.5px",
    margin: "0 0 20px 0",
    fontFamily: "'Syne', sans-serif",
  },
  sectionSub: {
    fontSize: "16px",
    color: "rgba(240,240,238,0.5)",
    lineHeight: 1.7,
    margin: "0 0 60px 0",
    fontFamily: "'Inter', sans-serif",
  },

  // Steps
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
  },
  step: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "16px",
    padding: "32px",
    position: "relative",
    overflow: "hidden",
    transition: "all 0.3s",
  },
  stepNum: {
    fontSize: "11px",
    letterSpacing: "2px",
    color: "#c8f03c",
    display: "block",
    marginBottom: "16px",
    fontFamily: "'Inter', sans-serif",
  },
  stepTitle: {
    fontSize: "20px",
    fontWeight: "700",
    margin: "0 0 12px 0",
    fontFamily: "'Syne', sans-serif",
  },
  stepDesc: {
    fontSize: "14px",
    color: "rgba(240,240,238,0.5)",
    lineHeight: 1.6,
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  stepActive: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "2px",
    background: "#c8f03c",
  },

  // Agents
  agentsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
  },
  agentCard: {
    background: "#111111",
    borderRadius: "16px",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    position: "relative",
  },
  soonBadge: {
    position: "absolute",
    top: "16px",
    right: "16px",
    background: "#1e1e1e",
    color: "#666",
    fontSize: "11px",
    padding: "4px 10px",
    borderRadius: "20px",
    letterSpacing: "1px",
  },
  agentTop: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  agentName: {
    fontSize: "20px",
    fontWeight: "700",
    margin: "0 0 2px 0",
    fontFamily: "'Syne', sans-serif",
  },
  agentRole: {
    fontSize: "12px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  agentMetric: {
    marginLeft: "auto",
    fontSize: "12px",
    color: "#c8f03c",
    fontFamily: "'Inter', sans-serif",
    fontWeight: "600",
  },
  agentDesc: {
    fontSize: "14px",
    color: "rgba(240,240,238,0.5)",
    lineHeight: 1.6,
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  agentSkills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  skill: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "11px",
    color: "rgba(240,240,238,0.5)",
    fontFamily: "'Inter', sans-serif",
  },
  agentBtn: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
    marginTop: "auto",
  },

  // Proof
  proofSection: {
    padding: "80px 0",
    background: "rgba(200,240,60,0.03)",
    borderTop: "1px solid rgba(200,240,60,0.1)",
    borderBottom: "1px solid rgba(200,240,60,0.1)",
  },
  proofGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "40px",
    textAlign: "center",
  },
  proofItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  proofValue: {
    fontSize: "48px",
    fontWeight: "800",
    letterSpacing: "-2px",
    fontFamily: "'Syne', sans-serif",
  },
  proofLabel: {
    fontSize: "14px",
    color: "rgba(240,240,238,0.4)",
    fontFamily: "'Inter', sans-serif",
  },

  // Plans
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
  },
  planCard: {
    borderRadius: "16px",
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    position: "relative",
  },
  planBadge: {
    position: "absolute",
    top: "-12px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#c8f03c",
    color: "#0a0a0b",
    fontSize: "11px",
    fontWeight: "700",
    padding: "4px 14px",
    borderRadius: "20px",
    whiteSpace: "nowrap",
    fontFamily: "'Inter', sans-serif",
    letterSpacing: "0.5px",
  },
  planName: {
    fontSize: "22px",
    fontWeight: "700",
    margin: 0,
    fontFamily: "'Syne', sans-serif",
  },
  planDesc: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    lineHeight: 1.5,
    fontFamily: "'Inter', sans-serif",
  },
  planPrice: {
    display: "flex",
    alignItems: "baseline",
    gap: "2px",
  },
  planCurrency: {
    fontSize: "20px",
    color: "rgba(240,240,238,0.5)",
  },
  planAmount: {
    fontSize: "52px",
    fontWeight: "800",
    lineHeight: 1,
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-2px",
  },
  planPeriod: {
    fontSize: "12px",
    color: "rgba(240,240,238,0.4)",
    margin: "0 0 8px 0",
    fontFamily: "'Inter', sans-serif",
  },
  planFeatures: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flex: 1,
  },
  planFeature: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.6)",
    display: "flex",
    alignItems: "center",
    fontFamily: "'Inter', sans-serif",
  },
  planBtn: {
    padding: "13px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
    marginTop: "8px",
  },

  // CTA
  ctaSection: {
    padding: "100px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  ctaBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "24px",
  },
  ctaTitle: {
    fontSize: "56px",
    fontWeight: "800",
    letterSpacing: "-2px",
    margin: 0,
    lineHeight: 1.1,
    fontFamily: "'Syne', sans-serif",
  },
  ctaSub: {
    fontSize: "16px",
    color: "rgba(240,240,238,0.5)",
    lineHeight: 1.7,
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },

  // Footer
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.06)",
    padding: "40px 60px",
  },
  footerInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  footerText: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.3)",
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  footerLinks: {
    display: "flex",
    gap: "24px",
  },
  footerLink: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.3)",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
};