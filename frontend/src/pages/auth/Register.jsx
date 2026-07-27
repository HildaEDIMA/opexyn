import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../../store/authStore";

const Logo = () => (
  <svg width="160" viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg">
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

export default function Register() {
  const navigate = useNavigate();
  const { register, login, isLoading, error } = useAuthStore();
  const [form, setForm] = useState({
    email: "", password: "", full_name: "",
    company_name: "", country: "", phone: "",
  });
  const [focused, setFocused] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

/*   const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await register(form);
    if (success) navigate("/login");
  };
 */
  const handleSubmit = async (e) => {
  e.preventDefault();
  const success = await register(form);
  if (success) {
    // Auto-login puis onboarding
    const logged = await login(form.email, form.password);
    if (logged) navigate("/onboarding");
    else navigate("/login");
  }
};

  const inputStyle = (name) => ({
    ...styles.input,
    borderColor: focused === name ? "#c8f03c" : "#1e1e1e",
    boxShadow: focused === name ? "0 0 0 3px rgba(200,240,60,0.08)" : "none",
  });

  const fp = (name) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  });

  return (
    <div style={styles.page}>
      <div style={styles.grid} />

      <div style={styles.container}>
        <div style={styles.card}>
          <Logo />
          <h2 style={styles.title}>Create your account</h2>

          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Full name</label>
                <input style={inputStyle("full_name")} name="full_name" placeholder="Jane Smith"
                  value={form.full_name} onChange={handleChange} {...fp("full_name")} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Company</label>
                <input style={inputStyle("company_name")} name="company_name" placeholder="Acme Inc."
                  value={form.company_name} onChange={handleChange} {...fp("company_name")} required />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input style={inputStyle("email")} name="email" type="email" placeholder="you@company.com"
                value={form.email} onChange={handleChange} {...fp("email")} required />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input style={inputStyle("password")} name="password" type="password" placeholder="••••••••"
                value={form.password} onChange={handleChange} {...fp("password")} required />
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Country <span style={styles.opt}>optional</span></label>
                <input style={inputStyle("country")} name="country" placeholder="France"
                  value={form.country} onChange={handleChange} {...fp("country")} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone <span style={styles.opt}>optional</span></label>
                <input style={inputStyle("phone")} name="phone" placeholder="+33 6 00 00 00"
                  value={form.phone} onChange={handleChange} {...fp("phone")} />
              </div>
            </div>

            <button
              style={{ ...styles.button, opacity: isLoading ? 0.7 : 1 }}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Get started →"}
            </button>
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or</span>
              <span style={styles.dividerLine} />
            </div>

            <button
              style={styles.googleBtn}
              type="button"
              onClick={() => window.location.href = "http://localhost:8000/api/auth/google"}
            >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
            </svg>
              Continue with Google
            </button>
          </form>

          <p style={styles.link}>
            Already have an account?{" "}
            <Link to="/login" style={styles.linkText}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0b",
    color: "#f0f0ee",
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  container: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    display: "flex",
    justifyContent: "center",
    padding: "24px",
  },
  card: {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: "16px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "460px",
    display: "flex",
    flexDirection: "column",
  },
  title: {
    color: "#f0f0ee",
    fontSize: "22px",
    fontWeight: "800",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-0.5px",
    margin: "28px 0 24px",
  },
  error: {
    background: "rgba(255,60,60,0.06)",
    border: "1px solid rgba(255,60,60,0.2)",
    color: "#ff8080",
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "16px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "10px",
    letterSpacing: "1.5px",
    color: "rgba(240,240,238,0.4)",
    fontFamily: "'Inter', sans-serif",
    textTransform: "uppercase",
  },
  opt: {
    color: "rgba(240,240,238,0.2)",
    fontSize: "9px",
    marginLeft: "4px",
    textTransform: "none",
    letterSpacing: 0,
  },
  input: {
    background: "#0a0a0b",
    border: "1px solid #1e1e1e",
    borderRadius: "8px",
    padding: "11px 14px",
    color: "#f0f0ee",
    fontSize: "13px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  button: {
    background: "#c8f03c",
    color: "#0a0a0b",
    border: "none",
    borderRadius: "8px",
    padding: "13px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
    marginTop: "4px",
  },
  link: {
    color: "rgba(240,240,238,0.35)",
    fontSize: "13px",
    textAlign: "center",
    marginTop: "24px",
    fontFamily: "'Inter', sans-serif",
  },
  linkText: {
    color: "#f0f0ee",
    textDecoration: "none",
    fontWeight: "600",
  },
  divider: {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "16px 0",
},
dividerLine: {
  flex: 1,
  height: "1px",
  background: "#1e1e1e",
  display: "block",
},
dividerText: {
  fontSize: "11px",
  color: "rgba(240,240,238,0.3)",
  fontFamily: "'Inter', sans-serif",
},
googleBtn: {
  width: "100%",
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: "8px",
  padding: "12px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  color: "#f0f0ee",
  fontFamily: "'Inter', sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
},
};