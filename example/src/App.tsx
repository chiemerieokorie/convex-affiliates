import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

function AffiliateDemo() {
  const [code, setCode] = useState("");
  const trackClick = useMutation(api.example.trackClick);

  const handleTrackClick = async () => {
    if (code.trim()) {
      const result = await trackClick({
        affiliateCode: code,
        landingPage: window.location.pathname,
      });
      if (result) {
        alert(`Click tracked! Referral ID: ${result.referralId}`);
      } else {
        alert("Invalid or inactive affiliate code");
      }
    }
  };

  return (
    <div
      style={{
        marginBottom: "2rem",
        padding: "1.5rem",
        border: "1px solid rgba(128, 128, 128, 0.3)",
        borderRadius: "8px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Track Referral Click</h2>
      <p style={{ color: "rgba(128, 128, 128, 0.8)", fontSize: "0.9rem" }}>
        Simulate tracking a click from an affiliate link
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter affiliate code"
          style={{ padding: "0.5rem", flex: 1 }}
        />
        <button onClick={handleTrackClick}>Track Click</button>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const dashboard = useQuery(api.example.adminDashboard);

  if (!dashboard) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div
      style={{
        marginBottom: "2rem",
        padding: "1.5rem",
        border: "1px solid rgba(128, 128, 128, 0.3)",
        borderRadius: "8px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Admin Dashboard</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1rem",
        }}
      >
        <StatCard label="Total Affiliates" value={dashboard.totalAffiliates} />
        <StatCard label="Pending Approvals" value={dashboard.pendingApprovals} />
        <StatCard label="Active Affiliates" value={dashboard.activeAffiliates} />
        <StatCard label="Total Clicks" value={dashboard.totalClicks} />
        <StatCard label="Total Signups" value={dashboard.totalSignups} />
        <StatCard label="Total Conversions" value={dashboard.totalConversions} />
        <StatCard
          label="Total Revenue"
          value={`$${(dashboard.totalRevenueCents / 100).toFixed(2)}`}
        />
        <StatCard
          label="Pending Payouts"
          value={`$${(dashboard.pendingPayoutsCents / 100).toFixed(2)}`}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "rgba(128, 128, 128, 0.1)",
        borderRadius: "8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{value}</div>
      <div style={{ fontSize: "0.8rem", color: "rgba(128, 128, 128, 0.8)" }}>
        {label}
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <h1>Convex Affiliates Demo</h1>
      <div className="card">
        <AffiliateDemo />
        <AdminDashboard />
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>About This Component</h3>
          <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
            This example demonstrates the Convex Affiliates component - a pure data
            layer for affiliate marketing.
          </p>
          <ul style={{ fontSize: "0.9rem", textAlign: "left" }}>
            <li>Zero-cookie tracking via URL parameters</li>
            <li>Flexible commission structures (percentage or fixed)</li>
            <li>NET-0/15/30/60/90 payout scheduling</li>
            <li>Manual payout recording (PayPal, bank transfer, etc.)</li>
          </ul>
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>
            See <code>example/convex/example.ts</code> for API usage and{" "}
            <code>example/convex/http.ts</code> for webhook integration
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
