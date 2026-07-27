import { useState, useEffect } from "react";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

export default function Context() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focused, setFocused] = useState(null);
  const [form, setForm] = useState({
    business_description: "",
    business_priorities: "",
    short_term_goals: "",
    long_term_goals: "",
  });

  useEffect(() => {
    api.get("/client/me").then((res) => {
      setForm({
        business_description: res.data.business_description || "",
        business_priorities: res.data.business_priorities || "",
        short_term_goals: res.data.short_term_goals || "",
        long_term_goals: res.data.long_term_goals || "",
      });
    });
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.put("/client/context", form);
      setSaved(true);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fields = [
    {
      name: "business_description",
      title: "Business Description",
      sub: "What does your company do? Who are your customers?",
      placeholder: "We are an e-commerce company selling handmade jewelry to customers in the US and Europe. Our main audience is women aged 25-45 who value unique, artisanal products...",
    },
    {
      name: "business_priorities",
      title: "Business Priorities",
      sub: "What matters most to your business right now?",
      placeholder: "1. Customer satisfaction above all — always resolve issues on first contact\n2. Fast response times — under 2 hours for all inquiries\n3. Brand tone — friendly, warm, personal...",
    },
    {
      name: "short_term_goals",
      title: "Short-term Goals",
      sub: "What are you trying to achieve in the next 1–3 months?",
      placeholder: "- Reduce average response time from 4h to under 1h\n- Handle the holiday season spike in support tickets\n- Improve customer satisfaction score from 3.8 to 4.5...",
    },
    {
      name: "long_term_goals",
      title: "Long-term Goals",
      sub: "Where do you want your business to be in 1–2 years?",
      placeholder: "- Scale to $5M ARR\n- Expand to 10 new markets\n- Build a fully automated customer support operation...",
    },
  ];

  const tips = [
    "Be specific about your tone — formal, casual, empathetic?",
    "Mention any topics your AI should never discuss",
    "Include your refund and return policy details",
    "List your most common customer questions",
  ];

  return (
    <div style={styles.container}>
      <Sidebar active="Company Context" />

      {/* Main */}
      <div style={styles.main}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.headerTitle}>Company Context</h2>
            <p style={styles.headerSub}>
              This information helps your AI employees understand your business deeply.
              The more detail you provide, the better they perform.
            </p>
          </div>
          <button
            style={{
              ...styles.saveBtn,
              background: saved ? "rgba(200,240,60,0.08)" : "#c8f03c",
              color: saved ? "#c8f03c" : "#0a0a0b",
              border: saved ? "1px solid rgba(200,240,60,0.25)" : "none",
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Saving..." : saved ? "✓ Saved" : "Save changes"}
          </button>
        </div>

        <div style={styles.grid}>
          {fields.map((field) => (
            <div
              key={field.name}
              style={{
                ...styles.card,
                borderColor: focused === field.name ? "rgba(200,240,60,0.2)" : "#1e1e1e",
              }}
            >
              <div>
                <h3 style={styles.cardTitle}>{field.title}</h3>
                <p style={styles.cardSub}>{field.sub}</p>
              </div>
              <textarea
                style={{
                  ...styles.textarea,
                  borderColor: focused === field.name ? "#c8f03c" : "#1e1e1e",
                  boxShadow: focused === field.name ? "0 0 0 3px rgba(200,240,60,0.08)" : "none",
                }}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                onFocus={() => setFocused(field.name)}
                onBlur={() => setFocused(null)}
                placeholder={field.placeholder}
                rows={5}
              />
            </div>
          ))}
        </div>

        {/* Tips */}
        <div style={styles.tips}>
          <h3 style={styles.tipsTitle}>
            <span style={styles.tipsAccent}>—</span> Tips for better AI performance
          </h3>
          <div style={styles.tipsGrid}>
            {tips.map((tip, i) => (
              <div key={i} style={styles.tip}>
                <span style={styles.tipDot}>→</span>
                {tip}
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    maxWidth: "480px",
    lineHeight: 1.7,
    fontFamily: "'Inter', sans-serif",
  },
  saveBtn: {
    padding: "10px 24px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    flexShrink: 0,
    transition: "all 0.25s",
    fontFamily: "'Syne', sans-serif",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "20px",
    marginBottom: "28px",
  },
  card: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "12px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    transition: "border-color 0.2s",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: "700",
    margin: "0 0 4px 0",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
    letterSpacing: "0.1px",
  },
  cardSub: {
    fontSize: "12px",
    color: "rgba(240,240,238,0.35)",
    margin: 0,
    lineHeight: 1.5,
    fontFamily: "'Inter', sans-serif",
  },
  textarea: {
    background: "#0a0a0b",
    border: "1px solid #1e1e1e",
    borderRadius: "8px",
    padding: "12px 14px",
    color: "#f0f0ee",
    fontSize: "13px",
    outline: "none",
    resize: "vertical",
    fontFamily: "'Inter', sans-serif",
    lineHeight: 1.7,
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  tips: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "40px",
  },
  tipsTitle: {
    fontSize: "13px",
    fontWeight: "700",
    margin: "0 0 16px 0",
    fontFamily: "'Syne', sans-serif",
    color: "#f0f0ee",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  tipsAccent: {
    color: "#c8f03c",
    fontWeight: "800",
  },
  tipsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
  },
  tip: {
    fontSize: "13px",
    color: "rgba(240,240,238,0.4)",
    display: "flex",
    gap: "8px",
    lineHeight: 1.6,
    fontFamily: "'Inter', sans-serif",
  },
  tipDot: {
    color: "#c8f03c",
    flexShrink: 0,
    fontWeight: "700",
  },
};