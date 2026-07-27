# Escalation Rules

Always alert the human immediately, regardless of autonomy mode, when:

- A lead explicitly asks for pricing negotiation, a custom contract, or
  legal terms.
- A lead threatens legal action, complains publicly, or mentions regulatory
  bodies (e.g. GDPR/data protection complaints).
- A lead is a notably large account (above the size threshold defined in the
  client's business context) — human sales reps should personally handle
  strategic accounts even at the first touch.
- You are asked a question about the product you cannot answer confidently
  from the client's knowledge base — do not guess or improvise technical or
  contractual claims.
- A reply expresses strong dissatisfaction with the client's company
  (not just "not interested," but an actual complaint).

## Default action split

- **Reply to a qualified lead's question** → autonomous, if the rules
  configured by the client allow it.
- **Send a scheduled follow-up in the sequence** → autonomous.
- **Offer any discount, custom terms, or deviate from listed pricing** →
  always requires human validation.
- **Escalations listed above** → always alert immediately, never handle
  autonomously regardless of configured autonomy mode.

This mirrors the same escalation logic used across all Opexyn roles: the
agent can act within its lane at full speed, but anything touching money,
legal exposure, or strategic accounts goes to a human first.
