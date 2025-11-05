import React, { useEffect, useState } from "react";

/**
 * CastQuotes - remote quotes + admin panel
 * - Fetches quotes from GitHub raw URL (fallback to localStorage or built-in defaults)
 * - One random quote per visit
 * - "Cast this quote" button with host composer / postMessage / clipboard fallbacks
 * - Local admin panel (⚙) to add/delete quotes and set a local password
 *
 * RAW_GITHUB_URL points to your repo's raw quotes.json
 */
const DEFAULT_QUOTES = [
  "Build in public, cast in style.",
  "One frame can change your feed.",
  "Stay decentralized, stay visible.",
  "Your words, onchain forever.",
  "BASE IS FOR EVERYONE",
  "JESSE IS BALD AND BASED",
  "ETH-erion for life",
  "Miniapp is the name, but bigger job than your PP",
  "BASED META",
  "Mint warplet or die",
  "CLANKER here, CLANKER there, CLANKER everywhere",
  "$NOICE? or NOICE",
  "SATOSHI is building now on BASE",
  "Yo mamma!",
  "CAST or you are GAY",
  "gm to the gmers and gm to the gners",
  "RUGGED onchain",
  "VITALIK GAY",
  "ETH to $10,690",
  "1 + 1 = BASED",
  "👁️🫦👁️",
  "NO FEE NOVEMBER",
  "NUT DAILY TRADE DAILY on FARCASTER",
  "📷🍑"
];

const STORAGE_KEY = "castquotes_quotes_v1";
const ADMIN_PW_KEY = "castquotes_admin_pw_v1";

// Use your cleaned raw URL
const RAW_GITHUB_URL =
  "https://raw.githubusercontent.com/HelloWorld2309/castquotes/main/quotes.json";

async function fetchQuotesFromGithub(): Promise<string[] | null> {
  try {
    const res = await fetch(RAW_GITHUB_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;
    return null;
  } catch {
    return null;
  }
}

function loadQuotes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_QUOTES.slice();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_QUOTES.slice();
  } catch {
    return DEFAULT_QUOTES.slice();
  }
}

function saveQuotes(qs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(qs));
  } catch {
    // ignore
  }
}

function getAdminPw(): string {
  const stored = localStorage.getItem(ADMIN_PW_KEY);
  return stored || "basedfin";
}

function persistAdminPw(pw: string) {
  try {
    localStorage.setItem(ADMIN_PW_KEY, pw);
  } catch {
    // ignore
  }
}

function pickRandomQuote(quotes: string[]) {
  const i = Math.floor(Math.random() * quotes.length);
  return quotes[i];
}

export default function App(): JSX.Element {
  const [quotes, setQuotes] = useState<string[]>(() => loadQuotes());
  const [quote, setQuote] = useState<string>("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"locked" | "unlocked">("locked");
  const [pwInput, setPwInput] = useState("");
  const [newQuoteText, setNewQuoteText] = useState("");
const [, setAdminPwState] = useState(getAdminPw());

  // Load quotes: try localStorage -> remote -> default
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) If local storage has user-edited quotes, prefer that immediately
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (!cancelled) {
              setQuotes(parsed);
              setQuote(pickRandomQuote(parsed));
            }
            return;
          }
        }
      } catch {
        // continue to remote attempt
      }

      // 2) Try remote GitHub
      const remote = await fetchQuotesFromGithub();
      if (!cancelled && remote) {
        setQuotes(remote);
        setQuote(pickRandomQuote(remote));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
        } catch {
          // ignore
        }
        return;
      }

      // 3) Fallback to built-in defaults
      if (!cancelled) {
        setQuotes(DEFAULT_QUOTES.slice());
        setQuote(pickRandomQuote(DEFAULT_QUOTES));
      }
    })();

    // Sync admin pw with storage
    setAdminPwState(getAdminPw());

    return () => {
      cancelled = true;
    };
  }, []); // run once on mount

  // Persist when quotes change (admin edits)
  useEffect(() => {
    saveQuotes(quotes);
  }, [quotes]);

  // Try opening Farcaster composer (best-effort)
  const tryOpenFarcasterComposer = async (text: string) => {
    try {
      // @ts-ignore
      const globalAny: any = (window as any).farcaster || (window as any).Farcaster;
      if (globalAny && typeof globalAny.openComposer === "function") {
        // @ts-ignore
        return globalAny.openComposer({ text });
      }
    } catch {
      // ignore
    }

    try {
      // Post message to parent (host may respond)
      window.parent.postMessage({ source: "castquotes-miniapp", type: "OPEN_COMPOSER", text }, "*");
      return;
    } catch {
      // ignore
    }

    try {
      await navigator.clipboard.writeText(text);
      alert("Quote copied to clipboard. Paste it into Farcaster to cast.");
    } catch {
      window.prompt("Copy this quote:", text);
    }
  };

  const onCastClick = async () => {
    if (!quote) return;
    await tryOpenFarcasterComposer(quote);
  };

  // Admin handlers
  const openAdmin = () => {
    setPwInput("");
    setAuthStep("locked");
    setAdminOpen(true);
  };

  const tryUnlock = () => {
    const pw = getAdminPw();
    if (pwInput === pw) {
      setAuthStep("unlocked");
      setPwInput("");
    } else {
      alert("Incorrect password.");
    }
  };

  const handleAddQuote = () => {
    const t = newQuoteText.trim();
    if (!t) return;
    const next = [t, ...quotes];
    setQuotes(next);
    setNewQuoteText("");
    alert("Quote added (saved locally).");
  };

  const handleDeleteQuote = (idx: number) => {
    if (!confirm("Delete this quote?")) return;
    const next = quotes.slice();
    next.splice(idx, 1);
    setQuotes(next);
    alert("Deleted (saved locally).");
  };

  const handleSetPw = () => {
    const t = pwInput.trim();
    if (t.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    persistAdminPw(t);
    setAdminPwState(t);
    alert("Password updated.");
    setPwInput("");
  };

  const handleResetToDefault = () => {
    if (!confirm("Reset all quotes to the original default list? This will overwrite local edits.")) return;
    const def = DEFAULT_QUOTES.slice();
    setQuotes(def);
    saveQuotes(def);
    alert("Reset complete.");
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>CastQuotes</div>
        <div style={styles.quote} aria-live="polite">
          {quote}
        </div>

        <button style={styles.castButton} onClick={onCastClick}>
          Cast this quote
        </button>
      </div>

      {/* Branding bottom-right */}
      <div style={styles.signature}>Made with love by 0xFIN</div>

      {/* Admin gear top-right */}
      <button title="Admin" aria-label="Open admin" onClick={openAdmin} style={styles.gearButton}>
        ⚙
      </button>

      {/* Admin modal */}
      {adminOpen && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true">
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <strong>Admin — CastQuotes</strong>
              <button onClick={() => setAdminOpen(false)} style={styles.closeBtn} aria-label="Close admin">
                ×
              </button>
            </div>

            {authStep === "locked" ? (
              <div>
                <p>Enter admin password to edit quotes.</p>
                <input value={pwInput} onChange={(e) => setPwInput(e.target.value)} placeholder="password" style={styles.input} />
                <div style={{ marginTop: 8 }}>
                  <button onClick={tryUnlock} style={styles.smallBtn}>Unlock</button>{" "}
                  <button onClick={() => alert("Default password (local-only): basedfin")} style={styles.smallGhost}>Forgot?</button>
                </div>
              </div>
            ) : (
              <div>
                <p>Manage quotes (saved locally).</p>

                <div style={{ marginBottom: 10 }}>
                  <input value={newQuoteText} onChange={(e) => setNewQuoteText(e.target.value)} placeholder="Add new quote here..." style={styles.input} />
                  <button onClick={handleAddQuote} style={{ ...styles.smallBtn, marginLeft: 8 }}>Add</button>
                </div>

                <div style={{ maxHeight: 260, overflow: "auto", borderRadius: 8, padding: 6 }}>
                  {quotes.map((q, i) => (
                    <div key={i} style={styles.quoteRow}>
                      <div style={{ flex: 1 }}>{q}</div>
                      <button onClick={() => handleDeleteQuote(i)} style={styles.delBtn}>Delete</button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <p style={{ marginBottom: 6, fontWeight: 600 }}>Change admin password</p>
                  <input value={pwInput} onChange={(e) => setPwInput(e.target.value)} placeholder="new password" style={styles.input} />
                  <button onClick={handleSetPw} style={{ ...styles.smallBtn, marginLeft: 8 }}>Save password</button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button onClick={handleResetToDefault} style={styles.warnBtn}>Reset quotes to default</button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <small>Notes: changes are stored in this browser's localStorage only.</small>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Styles */
const styles: { [k: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(180deg, rgba(10,10,20,1) 0%, rgba(20,18,30,1) 50%, rgba(10,10,20,1) 100%)",
    padding: 20,
    color: "#fff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
  },
  card: {
    width: 560,
    maxWidth: "92vw",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
    textAlign: "center",
    backdropFilter: "blur(6px)",
  },
  header: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 18,
    letterSpacing: 1,
  },
  quote: {
    fontSize: 22,
    lineHeight: 1.35,
    marginBottom: 26,
    padding: "0 6px",
    minHeight: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  castButton: {
    background: "linear-gradient(90deg,#ff7a18,#af002d)",
    border: "none",
    color: "#fff",
    padding: "12px 20px",
    fontSize: 16,
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
  },
  signature: {
    position: "fixed",
    bottom: 10,
    right: 14,
    fontSize: 13,
    opacity: 0.6,
    fontWeight: 500,
    letterSpacing: 0.3,
  },
  gearButton: {
    position: "fixed",
    top: 10,
    right: 10,
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 20,
    cursor: "pointer",
    opacity: 0.85,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: 16,
  },
  modal: {
    width: 720,
    maxWidth: "96vw",
    background: "#0f0f13",
    color: "#fff",
    borderRadius: 12,
    padding: 18,
    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 20,
    cursor: "pointer",
  },
  input: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    color: "#fff",
    width: "min(100%, 460px)",
  },
  smallBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "linear-gradient(90deg,#6bffb0,#00d4ff)",
    color: "#000",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },
  smallGhost: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "transparent",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer",
  },
  warnBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#ff4d6d",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },
  quoteRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "8px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.02)",
    marginBottom: 6,
  },
  delBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
};
