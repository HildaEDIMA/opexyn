import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

export const Logo = () => (
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

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Marketplace", path: "/marketplace" },
  { label: "Company Context", path: "/context" },
  { label: "Billing", path: "/billing" },
  { label: "Support", path: "/support" },
];

/**
 * Sidebar unique et réutilisable pour toutes les pages authentifiées.
 * Reprend le layout de référence (Dashboard.jsx) : logo, nav à 5 entrées,
 * bloc client + menu de déconnexion en bas.
 *
 * @param {string} active - label du NAV_ITEMS actuellement actif
 *                           (ex: "Dashboard", "Billing"...). Optionnel :
 *                           si aucun item ne correspond, aucun n'est
 *                           surligné (utile pour les pages hors nav,
 *                           comme un flow d'onboarding).
 */
export default function Sidebar({ active }) {
  const navigate = useNavigate();
  const { client, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogout = () => {
    setMenuOpen(false);
    setConfirmOpen(true);
  };

  return (
    <div style={s.sidebar}>
      <div>
        <div style={s.logoWrap}><Logo /></div>
        <nav style={s.nav}>
          {NAV_ITEMS.map(item => (
            <div
              key={item.label}
              style={active === item.label ? s.navItemActive : s.navItem}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      <div style={s.sidebarBottom}>
        {menuOpen && (
          <div style={s.accountMenu}>
            <div style={s.accountMenuItem} onClick={handleLogout}>
              <span style={s.accountMenuIcon}>↗</span> Sign out
            </div>
          </div>
        )}

        <div
          style={{ ...s.clientInfo, cursor: "pointer", userSelect: "none" }}
          onClick={() => setMenuOpen(o => !o)}
        >
          <div style={s.clientAvatar}>
            {client?.full_name?.charAt(0) || "?"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.clientName}>{client?.full_name || "..."}</div>
            <div style={s.clientCompany}>{client?.company_name || "..."}</div>
          </div>
          <div style={{ ...s.chevron, transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
            ⌄
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div style={s.modalOverlay} onClick={() => setConfirmOpen(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <p style={s.modalTitle}>Déconnexion</p>
            <p style={s.modalSub}>Voulez-vous vraiment vous déconnecter ?</p>
            <div style={s.modalBtns}>
              <button style={s.modalCancel} onClick={() => setConfirmOpen(false)}>Annuler</button>
              <button style={s.modalConfirm} onClick={() => { setConfirmOpen(false); logout(); }}>Se déconnecter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles partagés — largeur 240px, fond #111111, accent lime #c8f03c.
// Exportés pour que chaque page les réutilise pour son propre `main`
// (marginLeft 240px, padding 48px 40px, fond #0a0a0b, etc.)
export const sidebarWidth = "240px";

const s = {
  sidebar: {
    width: "240px", background: "#111111",
    borderRight: "1px solid #1e1e1e",
    display: "flex", flexDirection: "column",
    justifyContent: "space-between",
    padding: "28px 16px", position: "fixed",
    height: "100vh", boxSizing: "border-box",
  },
  logoWrap: { marginBottom: "36px", paddingLeft: "8px" },
  nav: { display: "flex", flexDirection: "column", gap: "2px" },
  navItem: {
    padding: "10px 12px", borderRadius: "8px",
    fontSize: "13px", color: "rgba(240,240,238,0.4)",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },
  navItemActive: {
    padding: "10px 12px", borderRadius: "8px",
    fontSize: "13px", color: "#c8f03c",
    background: "rgba(200,240,60,0.08)", fontWeight: "600",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    border: "1px solid rgba(200,240,60,0.15)",
  },
  sidebarBottom: { display: "flex", flexDirection: "column", gap: "10px" },
  clientInfo: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "12px", background: "rgba(255,255,255,0.03)",
    border: "1px solid #1e1e1e", borderRadius: "10px",
  },
  clientAvatar: {
    width: "32px", height: "32px", background: "#c8f03c",
    color: "#0a0a0b", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: "800", flexShrink: 0,
    fontFamily: "'Syne', sans-serif",
  },
  clientName: { fontSize: "13px", fontWeight: "600", color: "#f0f0ee" },
  clientCompany: { fontSize: "11px", color: "rgba(240,240,238,0.35)" },
  chevron: {
    fontSize: "14px", color: "rgba(240,240,238,0.25)",
    lineHeight: 1, transition: "transform 0.2s ease",
  },
  accountMenu: {
    background: "#161616", border: "1px solid #1e1e1e",
    borderRadius: "10px", padding: "6px",
    marginBottom: "6px",
  },
  accountMenuItem: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "9px 12px", borderRadius: "7px",
    fontSize: "12px", color: "rgba(240,240,238,0.5)",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },
  accountMenuIcon: { fontSize: "11px", opacity: 0.5 },
  modalOverlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  modalBox: {
    background: "#111111", border: "1px solid #1e1e1e",
    borderRadius: "16px", padding: "28px 32px",
    width: "320px", boxSizing: "border-box",
  },
  modalTitle: {
    fontSize: "16px", fontWeight: "800", margin: "0 0 8px 0",
    fontFamily: "'Syne', sans-serif", color: "#f0f0ee",
  },
  modalSub: {
    fontSize: "13px", color: "rgba(240,240,238,0.4)",
    margin: "0 0 24px 0", lineHeight: "1.5",
  },
  modalBtns: { display: "flex", gap: "10px" },
  modalCancel: {
    flex: 1, background: "transparent", border: "1px solid #1e1e1e",
    color: "rgba(240,240,238,0.4)", borderRadius: "8px",
    padding: "10px", fontSize: "13px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  modalConfirm: {
    flex: 1, background: "#c8f03c", border: "none",
    color: "#0a0a0b", borderRadius: "8px",
    padding: "10px", fontSize: "13px", fontWeight: "700",
    cursor: "pointer", fontFamily: "'Syne', sans-serif",
  },
};