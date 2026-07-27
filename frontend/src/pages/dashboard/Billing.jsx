import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

const plans = [
  {
    id: "discovery",
    name: "Discovery",
    price: 149,
    tickets: 100,
    agents: 1,
    duration: "One month only",
    features: [
      "1 AI employee",
      "100 tickets/day",
      "24/7 autonomous operation",
      "Daily reports",
      "Email & WhatsApp support",
    ],
    highlight: false,
    badge: null,
  },
  {
    id: "startup",
    name: "Startup",
    price: 399,
    tickets: 200,
    agents: 3,
    duration: "3 month commitment",
    features: [
      "Up to 3 AI employees",
      "200 tickets/day per agent",
      "24/7 autonomous operation",
      "Daily reports",
      "All channels supported",
      "Priority support",
    ],
    highlight: true,
    badge: "Most Popular",
  },
  {
    id: "growth",
    name: "Growth",
    price: 699,
    tickets: 500,
    agents: 999,
    duration: "Monthly",
    features: [
      "Unlimited AI employees",
      "500 tickets/day per agent",
      "24/7 autonomous operation",
      "Advanced analytics",
      "All channels supported",
      "Dedicated support",
      "Custom integrations",
    ],
    highlight: false,
    badge: "Best Value",
  },
];

export default function Billing() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "cancelled") {
      setNotification({ type: "error", message: "Payment cancelled." });
    }
  }, []);

  const handleCheckout = async (planId) => {
    setLoading(planId);
    try {
      const res = await api.post(`/billing/checkout/${planId}`, {});
      window.location.href = res.data.checkout_url;
    } catch (err) {
      setNotification({ type: "error", message: "Something went wrong. Please try again." });
      setLoading(null);
    }
  };

  return (
    <div style={styles.container}>
      <Sidebar active="Billing" />

      {/* Main */}
      <div style={styles.main}>
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Choose your plan</h2>
          <p style={styles.headerSub}>Start with a Discovery trial or commit to a plan. Cancel anytime.</p>
        </div>

        {notification && (
          <div style={{
            ...styles.notification,
            background: notification.type === "error" ? "rgba(255,60,60,0.06)" : "rgba(200,240,60,0.06)",
            borderColor: notification.type === "error" ? "rgba(255,60,60,0.2)" : "rgba(200,240,60,0.2)",
            color: notification.type === "error" ? "#ff8080" : "#c8f03c",
          }}>
            {notification.message}
          </div>
        )}

        {/* Plans */}
        <div style={styles.plansGrid}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                ...styles.planCard,
                border: plan.highlight ? "1px solid #c8f03c" : "1px solid #1e1e1e",
                background: plan.highlight ? "rgba(200,240,60,0.03)" : "#111111",
              }}
            >
              {plan.badge && (
                <div style={{
                  ...styles.badge,
                  background: plan.highlight ? "#c8f03c" : "#1e1e1e",
                  color: plan.highlight ? "#0a0a0b" : "rgba(240,240,238,0.5)",
                }}>
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 style={styles.planName}>{plan.name}</h3>
                <p style={styles.planDuration}>{plan.duration}</p>
              </div>

              <div style={styles.planPrice}>
                <span style={styles.currency}>$</span>
                <span style={styles.amount}>{plan.price}</span>
                <span style={styles.period}>/month</span>
              </div>

              <div style={styles.planStats}>
                <div style={styles.stat}>
                  <span style={{ ...styles.statValue, color: plan.highlight ? "#c8f03c" : "#f0f0ee" }}>
                    {plan.agents === 999 ? "∞" : plan.agents}
                  </span>
                  <span style={styles.statLabel}>{plan.agents === 1 ? "agent" : "agents"}</span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.stat}>
                  <span style={{ ...styles.statValue, color: plan.highlight ? "#c8f03c" : "#f0f0ee" }}>
                    {plan.tickets}
                  </span>
                  <span style={styles.statLabel}>tickets/day</span>
                </div>
              </div>

              <ul style={styles.features}>
                {plan.features.map((f, i) => (
                  <li key={i} style={styles.feature}>
                    <span style={{ ...styles.check, color: plan.highlight ? "#c8f03c" : "rgba(240,240,238,0.4)" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                style={{
                  ...styles.planBtn,
                  background: plan.highlight ? "#c8f03c" : "transparent",
                  color: plan.highlight ? "#0a0a0b" : "#f0f0ee",
                  border: plan.highlight ? "none" : "1px solid #1e1e1e",
                  opacity: loading === plan.id ? 0.7 : 1,
                }}
                onClick={() => handleCheckout(plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? "Redirecting..." : `Get ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Custom plan */}
        <div style={styles.customPlan}>
          <div>
            <h3 style={styles.customTitle}>Need a custom plan?</h3>
            <p style={styles.customSub}>Tailored pricing for enterprise teams with specific needs.</p>
          </div>
          <button style={styles.customBtn}>Contact us</button>
        </div>

        {/* FAQ */}
        <div style={styles.faq}>
          <h3 style={styles.faqTitle}>Common questions</h3>
          <div style={styles.faqGrid}>
            {[
              {
                q: "Can I cancel anytime?",
                a: "Discovery plan is one month only. Startup requires 3 months. Growth is monthly and can be cancelled anytime.",
              },
              {
                q: "How does the ticket limit work?",
                a: "Your AI employee handles up to the daily ticket limit. If the limit is reached, tickets queue for the next day.",
              },
              {
                q: "What channels does Alex support?",
                a: "Email, WhatsApp Business, Instagram DMs, and more channels depending on your plan.",
              },
              {
                q: "Is my data secure?",
                a: "All data is encrypted at rest and in transit. Each client has isolated storage and dedicated agent instances.",
              },
            ].map((item, i) => (
              <div key={i} style={styles.faqItem}>
                <h4 style={styles.faqQ}>{item.q}</h4>
                <p style={styles.faqA}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
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
    margin: "0 0 6px 0",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-0.5px",
    color: "#f0f0ee",
  },
  headerSub: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  notification: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid",
    fontSize: "13px",
    marginBottom: "24px",
    fontFamily: "'Inter', sans-serif",
  },
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
    marginBottom: "28px",
  },
  planCard: {
    borderRadius: "16px",
    padding: "28px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  badge: {
    position: "absolute",
    top: "-12px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    fontFamily: "'Inter', sans-serif",
  },
  planName: {
    fontSize: "17px",
    fontWeight: "800",
    margin: "0 0 4px 0",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-0.3px",
    color: "#f0f0ee",
  },
  planDuration: {
    fontSize: "11px",
    color: "rgba(240,240,238,0.35)",
    margin: 0,
    letterSpacing: "0.5px",
    fontFamily: "'Inter', sans-serif",
  },
  planPrice: {
    display: "flex",
    alignItems: "baseline",
    gap: "2px",
  },
  currency: {
    fontSize: "18px",
    color: "rgba(240,240,238,0.4)",
  },
  amount: {
    fontSize: "48px",
    fontWeight: "800",
    lineHeight: 1,
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-2px",
    color: "#f0f0ee",
  },
  period: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.35)",
    marginLeft: "4px",
    fontFamily: "'Inter', sans-serif",
  },
  planStats: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid #1e1e1e",
    borderRadius: "10px",
    padding: "12px 16px",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "800",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-0.5px",
  },
  statLabel: {
    fontSize: "10px",
    color: "rgba(240,240,238,0.35)",
    fontFamily: "'Inter', sans-serif",
    letterSpacing: "0.5px",
  },
  statDivider: {
    width: "1px",
    height: "28px",
    background: "#1e1e1e",
  },
  features: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flex: 1,
  },
  feature: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.55)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "'Inter', sans-serif",
  },
  check: {
    fontWeight: "700",
    fontSize: "12px",
  },
  planBtn: {
    padding: "12px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s",
    fontFamily: "'Syne', sans-serif",
  },
  customPlan: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "12px",
    padding: "24px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },
  customTitle: {
    fontSize: "15px",
    fontWeight: "700",
    margin: "0 0 4px 0",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
  },
  customSub: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  customBtn: {
    background: "transparent",
    border: "1px solid #1e1e1e",
    color: "#f0f0ee",
    borderRadius: "8px",
    padding: "10px 24px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
  },
  faq: {
    marginBottom: "40px",
  },
  faqTitle: {
    fontSize: "15px",
    fontWeight: "700",
    margin: "0 0 20px 0",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
  },
  faqGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "14px",
  },
  faqItem: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "10px",
    padding: "20px",
  },
  faqQ: {
    fontSize: "13px",
    fontWeight: "600",
    margin: "0 0 8px 0",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
  },
  faqA: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
    lineHeight: 1.7,
    fontFamily: "'Inter', sans-serif",
  },
};