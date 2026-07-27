import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get("token");
    const isNew = searchParams.get("new") === "true";
    const error = searchParams.get("error");

    if (error) {
      navigate("/login", { replace: true });
      return;
    }

    if (token) {
      localStorage.setItem("token", token);
      // Petit délai pour que localStorage soit bien écrit
      setTimeout(() => {
        if (isNew) {
          navigate("/onboarding", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }, 100);
    } else {
      navigate("/login", { replace: true });
    }
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.spinner} />
      <p style={styles.text}>Signing you in...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0b",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    fontFamily: "'Inter', sans-serif",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "2px solid #1e1e1e",
    borderTopColor: "#c8f03c",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  text: {
    fontSize: "14px",
    color: "rgba(240,240,238,0.4)",
    margin: 0,
  },
};