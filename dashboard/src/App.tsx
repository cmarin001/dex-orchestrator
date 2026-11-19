import { useState } from "react";
import { request } from "./api/client";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";

export default function App() {
  const [token, setToken] = useState("");
  const [page, setPage] = useState<"dashboard" | "history">("dashboard");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  return <><header className="top"><div className="wrap bar"><div className="brand">TradeKeel <span>Paper desk</span></div>
    {token && <nav aria-label="Dashboard"><button aria-pressed={page === "dashboard"} onClick={() => setPage("dashboard")}>Dashboard</button>
      <button aria-pressed={page === "history"} onClick={() => setPage("history")}>History</button>
      <button onClick={() => { setToken(""); setError(""); }}>Disconnect</button></nav>}
    </div></header>
    <main className="wrap">{token ? page === "dashboard" ? <Dashboard token={token} /> : <History token={token} /> :
      <section className="panel login"><h1>Connect to the paper desk</h1>
        <form onSubmit={async event => {
          event.preventDefault();
          const value = String(new FormData(event.currentTarget).get("token")).trim();
          setConnecting(true);
          setError("");
          try { await request("/health", value); setToken(value); }
          catch (failure) { setError((failure as Error).message); }
          finally { setConnecting(false); }
        }}><label>Dashboard access token<input name="token" type="password" required autoComplete="off" /></label>
        <button type="submit" disabled={connecting}>{connecting ? "Connecting…" : "Connect"}</button></form>
        {error && <p role="alert">{error}</p>}</section>}</main></>;
}
