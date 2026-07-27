// Source unique de vérité pour l'affichage du statut d'un agent.
// Utilisé à la fois par Dashboard.jsx (liste) et AgentDashboard.jsx (détail),
// pour éviter que les deux vues divergent sur ce qu'un même statut backend
// signifie visuellement (couleur + label).

export const AGENT_STATUS = {
  active:     { color: "#c8f03c", label: "Active" },
  working:    { color: "#60a5fa", label: "Working" },
  sleeping:   { color: "#facc15", label: "Sleeping" },
  offline:    { color: "#f87171", label: "Offline" },
  connecting: { color: "#a78bfa", label: "Connecting" },
};

/**
 * Détermine la clé de statut à afficher à partir de la réponse brute de
 * GET /agent/status/{agentId} (ex: { status: "active", is_busy: false }).
 *
 * Règles (identiques partout) :
 * - Pas de données encore reçues → "connecting"
 * - is_busy=true → "working" (prioritaire sur le status brut)
 * - Sinon on prend le status backend s'il est connu, sinon "connecting"
 */
export function resolveAgentStatusKey(agentStatus) {
  if (!agentStatus) return "connecting";
  if (agentStatus.is_busy) return "working";
  if (agentStatus.status && AGENT_STATUS[agentStatus.status]) return agentStatus.status;
  return "connecting";
}

export function getAgentStatusDisplay(agentStatus) {
  const key = resolveAgentStatusKey(agentStatus);
  return { key, ...AGENT_STATUS[key] };
}