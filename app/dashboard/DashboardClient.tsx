"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardClientProps {
  sessionToken: string;
}

interface Client {
  id: string;
  name: string;
  url: string;
  created_at: string;
  lastScanId?: string | null;
  lastScanDate: string | null;
  lastScanStatus: string | null;
  complianceStatus: string;
}

interface ClientScan {
  id: string;
  url: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  complianceStatus: string;
  gdprScore: number | null;
}

export default function DashboardClient({ sessionToken }: DashboardClientProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [userType, setUserType] = useState<"user" | "subscriber" | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Agency-specific state
  const [isAgency, setIsAgency] = useState(false);
  const [agencyTab, setAgencyTab] = useState<"clients" | "scans">("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientScans, setClientScans] = useState<ClientScan[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [newClientUrl, setNewClientUrl] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [clientError, setClientError] = useState("");
  const [clientSuccess, setClientSuccess] = useState("");
  const [scanningClient, setScanningClient] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) {
      setError("Not logged in.");
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => {
        if (res.status === 401) {
          setError("Session expired or subscription inactive. Please renew.");
          return null;
        }
        return res.json() as Promise<{
          authenticated: boolean;
          email: string;
          type: string;
          plan: string;
          status: string;
          currentPeriodEnd: string;
          cancelAtPeriodEnd: boolean;
        }>;
      })
      .then((data) => {
        if (data?.authenticated) {
          setEmail(data.email);
          setUserType(data.type as "user" | "subscriber");
          setAuthenticated(true);
          if (data.type === "subscriber") {
            setSubscriptionStatus({
              plan: data.plan,
              status: data.status,
              currentPeriodEnd: data.currentPeriodEnd,
              cancelAtPeriodEnd: data.cancelAtPeriodEnd,
            });
            setIsAgency(data.plan === "agency");
            if (data.plan === "agency") {
              loadClients();
            } else {
              loadScans(data.type as "user" | "subscriber");
            }
          } else {
            loadScans(data.type as "user" | "subscriber");
          }
        }
      })
      .catch(() => setError("Failed to load dashboard."));
  }, [sessionToken]);

  const loadClients = () => {
    fetch("/api/clients", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => res.json() as Promise<{ clients: Client[] }>)
      .then((data) => {
        if (data.clients) setClients(data.clients);
      })
      .catch(() => {});
  };

  const loadScans = (type: "user" | "subscriber") => {
    if (type === "subscriber") {
      fetch("/api/scan/subscriber", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
        .then((res) => res.json() as Promise<{ scans: any[] }>)
        .then((data) => {
          if (data.scans) setRecentScans(data.scans);
        })
        .catch(() => {});
    } else {
      fetch("/api/scan/user", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
        .then((res) => res.json() as Promise<{ scans: any[] }>)
        .then((data) => {
          if (data.scans) setRecentScans(data.scans);
        })
        .catch(() => {});
    }
  };

  const loadClientDetails = (clientId: string) => {
    fetch(`/api/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => res.json() as Promise<{ client: Client; scans: ClientScan[] }>)
      .then((data) => {
        if (data.client) setSelectedClient(data.client);
        if (data.scans) setClientScans(data.scans);
      })
      .catch(() => {});
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !sessionToken) return;

    setScanning(true);
    setScanMessage("");
    setError("");

    if (userType === "subscriber") {
      const res = await fetch("/api/scan/subscriber", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, token: sessionToken }),
      });
      const data = await res.json() as { scanId?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Scan failed. Please try again.");
        return;
      }
      setScanMessage("Scan started! The report will appear in your history once ready.");
      setUrl("");
      if (data.scanId) {
        setRecentScans((prev) => [
          { id: data.scanId, url, status: "processing", created_at: new Date().toISOString() },
          ...prev,
        ]);
      }
    } else {
      const res = await fetch("/api/scan/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { scanId?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Scan failed. Please try again.");
        return;
      }
      setScanMessage("Scan started! The report will appear below once ready.");
      setUrl("");
      if (data.scanId) {
        setRecentScans((prev) => [
          { id: data.scanId, url, status: "processing", created_at: new Date().toISOString() },
          ...prev,
        ]);
      }
    }
    setScanning(false);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientUrl) return;

    setAddingClient(true);
    setClientError("");
    setClientSuccess("");

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ name: newClientName, url: newClientUrl }),
    });

    const data = await res.json() as { error?: string };
    if (!res.ok) {
      setClientError(data.error || "Failed to add client.");
      return;
    }

    setClientSuccess(`Client "${newClientName}" added successfully.`);
    setNewClientName("");
    setNewClientUrl("");
    loadClients();
    setAddingClient(false);
  };

  const handleScanClient = async (clientId: string) => {
    setScanningClient(clientId);
    setClientError("");

    const res = await fetch("/api/scan/client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ clientId, token: sessionToken }),
    });

    const data = await res.json() as { error?: string };
    if (!res.ok) {
      setClientError(data.error || "Scan failed.");
      return;
    }

    setClientSuccess("Scan started! The report will appear in client history once ready.");
    // Refresh client list and details
    loadClients();
    setTimeout(() => loadClientDetails(clientId), 1000);
    setScanningClient(null);
  };

  const handleRemoveClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to remove this client?")) return;

    const res = await fetch(`/api/clients/${clientId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    if (res.ok) {
      setClients(clients.filter(c => c.id !== clientId));
      if (selectedClient?.id === clientId) {
        setSelectedClient(null);
        setClientScans([]);
      }
    }
  };

  const handleLogout = () => {
    document.cookie = "session=; Max-Age=0; path=/";
    document.cookie = "session_token=; Max-Age=0; path=/";
    window.location.href = "/";
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Required</h1>
          <p className="text-white/60 mb-6">{error || "Please log in to access your dashboard."}</p>
          <Link href="/" className="inline-block px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-glow transition-all">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const periodEnd = subscriptionStatus?.currentPeriodEnd
    ? new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich" })
    : null;
  const isCancelling = subscriptionStatus?.cancelAtPeriodEnd;

  // ── Agency Dashboard View ──
  if (isAgency) {
    return (
      <div className="min-h-screen bg-midnight">
        {/* Header */}
        <header className="border-b border-white/10 bg-midnight-light">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-heading text-xl font-bold text-white hover:text-accent-glow transition-colors">
              ComplyScan
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-white/60 text-sm">{email}</span>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full font-medium">
                Agency Plan
              </span>
              <button onClick={handleLogout} className="text-sm text-white/50 hover:text-white transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-1">Agency Dashboard</h1>
            <p className="text-white/60">Manage your clients and their GDPR compliance scans.</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mb-6 bg-midnight-light rounded-lg p-1 w-fit">
            <button
              onClick={() => setAgencyTab("clients")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                agencyTab === "clients"
                  ? "bg-accent-blue text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              My Clients
            </button>
            <button
              onClick={() => setAgencyTab("scans")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                agencyTab === "scans"
                  ? "bg-accent-blue text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              All Scans
            </button>
          </div>

          {/* Add Client Form */}
          {agencyTab === "clients" && (
            <div className="bg-midnight-light border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Add New Client</h2>
              <form onSubmit={handleAddClient} className="flex gap-3">
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Client Name"
                  required
                  className="flex-1 rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue transition-all"
                />
                <input
                  type="url"
                  value={newClientUrl}
                  onChange={(e) => setNewClientUrl(e.target.value)}
                  placeholder="https://client-website.com"
                  required
                  className="flex-1 rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue transition-all"
                />
                <button
                  type="submit"
                  disabled={addingClient}
                  className="rounded-lg bg-accent-blue px-6 py-3 font-semibold text-white hover:bg-accent-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {addingClient ? "Adding..." : "Add Client"}
                </button>
              </form>
              {clientError && <p className="mt-3 text-sm text-red-400">{clientError}</p>}
              {clientSuccess && <p className="mt-3 text-sm text-green-400">{clientSuccess}</p>}
            </div>
          )}

          {/* Messages */}
          {clientError && agencyTab === "scans" && <p className="mb-4 text-sm text-red-400">{clientError}</p>}
          {clientSuccess && agencyTab === "scans" && <p className="mb-4 text-sm text-green-400">{clientSuccess}</p>}

          {/* Clients Table */}
          {agencyTab === "clients" && (
            <>
              {clients.length === 0 ? (
                <div className="text-center py-12 text-white/40 bg-midnight-light rounded-2xl border border-white/10">
                  No clients yet. Add your first client above to get started.
                </div>
              ) : (
                <div className="bg-midnight-light border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-6 py-4 text-white/60 text-sm font-medium">Name</th>
                        <th className="text-left px-6 py-4 text-white/60 text-sm font-medium">URL</th>
                        <th className="text-left px-6 py-4 text-white/60 text-sm font-medium">Last Scan</th>
                        <th className="text-left px-6 py-4 text-white/60 text-sm font-medium">Status</th>
                        <th className="text-left px-6 py-4 text-white/60 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => (
                        <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-white font-medium">{client.name}</td>
                          <td className="px-6 py-4 text-white/60 text-sm">{client.url}</td>
                          <td className="px-6 py-4 text-white/60 text-sm">
                            {client.lastScanDate
                              ? new Date(client.lastScanDate).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich" })
                              : "Never"}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              client.complianceStatus === "compliant"
                                ? "bg-green-500/20 text-green-400"
                                : client.complianceStatus === "non-compliant"
                                ? "bg-red-500/20 text-red-400"
                                : client.complianceStatus === "scanning"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-white/10 text-white/40"
                            }`}>
                              {client.complianceStatus === "compliant" ? "Compliant" :
                               client.complianceStatus === "non-compliant" ? "Non-Compliant" :
                               client.complianceStatus === "scanning" ? "Scanning..." : "Unknown"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {client.lastScanStatus === "completed" && client.lastScanId && (
                                <a
                                  href={`/report/${client.lastScanId}?token=${encodeURIComponent(sessionToken)}`}
                                  className="text-xs bg-accent-blue/20 text-accent-blue px-3 py-1.5 rounded-lg hover:bg-accent-blue/30 transition-all"
                                >
                                  View Report
                                </a>
                              )}
                              <button
                                onClick={() => handleScanClient(client.id)}
                                disabled={scanningClient === client.id}
                                className="text-xs bg-white/10 text-white/80 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-all disabled:opacity-50"
                              >
                                {scanningClient === client.id ? "Scanning..." : "Rescan"}
                              </button>
                              <button
                                onClick={() => handleRemoveClient(client.id)}
                                className="text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-all"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Client Details Panel */}
              {selectedClient && (
                <div className="mt-8 bg-midnight-light border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Scan History: {selectedClient.name}
                  </h3>
                  {clientScans.length === 0 ? (
                    <p className="text-white/40 text-sm">No scans yet for this client.</p>
                  ) : (
                    <div className="space-y-3">
                      {clientScans.map((scan) => (
                        <div key={scan.id} className="bg-midnight border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{scan.url}</p>
                            <p className="text-white/40 text-sm mt-1">
                              {scan.created_at
                                ? new Date(scan.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich" })
                                : "—"}
                              {" · "}
                              <span className={`capitalize ${
                                scan.status === "completed" ? "text-green-400" :
                                scan.status === "processing" ? "text-yellow-400" :
                                scan.status === "failed" ? "text-red-400" : "text-white/40"
                              }`}>
                                {scan.status}
                              </span>
                              {scan.gdprScore !== null && (
                                <> · Score: <span className={scan.gdprScore >= 75 ? "text-green-400" : "text-red-400"}>{scan.gdprScore}/100</span></>
                              )}
                            </p>
                          </div>
                          {scan.status === "completed" && (
                            <a
                              href={`/report/${scan.id}?token=${encodeURIComponent(sessionToken)}&agency=true`}
                              className="text-sm bg-accent-blue/20 text-accent-blue px-4 py-2 rounded-lg hover:bg-accent-blue/30 transition-all"
                            >
                              View Report
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* All Scans View */}
          {agencyTab === "scans" && (
            <div className="space-y-3">
              {recentScans.length === 0 ? (
                <div className="text-center py-12 text-white/40 bg-midnight-light rounded-2xl border border-white/10">
                  No scans yet. Add a client and run a scan to see history here.
                </div>
              ) : (
                recentScans.map((scan) => (
                  <div key={scan.id} className="bg-midnight-light border border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{scan.url || "(no URL)"}</p>
                      <p className="text-white/40 text-sm mt-1">
                        {scan.created_at
                          ? new Date(scan.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich" })
                          : "—"}
                        {" · "}
                        <span className={`capitalize ${
                          scan.status === "completed" ? "text-green-400" :
                          scan.status === "processing" ? "text-yellow-400" :
                          scan.status === "failed" ? "text-red-400" : "text-white/40"
                        }`}>
                          {scan.status}
                        </span>
                      </p>
                    </div>
                    {scan.status === "completed" && (
                      <a
                        href={`/report/${scan.id}?token=${encodeURIComponent(sessionToken)}&agency=true`}
                        className="text-sm bg-accent-blue/20 text-accent-blue px-4 py-2 rounded-lg hover:bg-accent-blue/30 transition-all"
                      >
                        View Report
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ── Regular Subscriber/User Dashboard ──
  return (
    <div className="min-h-screen bg-midnight">
      {/* Header */}
      <header className="border-b border-white/10 bg-midnight-light">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-heading text-xl font-bold text-white hover:text-accent-glow transition-colors">
            ComplyScan
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-white/60 text-sm">{email}</span>
            {userType === "subscriber" && (
              <span className="text-xs bg-accent-blue/20 text-accent-blue px-2 py-1 rounded-full font-medium">
                Monthly Plan
              </span>
            )}
            <button onClick={handleLogout} className="text-sm text-white/50 hover:text-white transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              {userType === "subscriber" ? "Subscriber Dashboard" : "Your Dashboard"}
            </h1>
            <p className="text-white/60">
              {userType === "subscriber"
                ? "Unlimited GDPR compliance scans included in your plan."
                : "Run GDPR compliance scans on any website."}
            </p>
          </div>
        </div>

        {/* Subscription status banner for subscribers */}
        {userType === "subscriber" && subscriptionStatus && (
          <div className={`rounded-xl p-4 mb-6 border ${isCancelling ? "bg-yellow-500/10 border-yellow-500/30" : "bg-accent-blue/10 border-accent-blue/30"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isCancelling ? "text-yellow-400" : "text-accent-blue"}`}>
                  {isCancelling
                    ? "Cancellation scheduled"
                    : subscriptionStatus.status === "active"
                    ? "Subscription active"
                    : subscriptionStatus.status}
                </p>
                {periodEnd && (
                  <p className="text-white/50 text-xs mt-1">
                    {isCancelling
                      ? `Access until ${periodEnd} — your subscription will not renew.`
                      : `Next billing date: ${periodEnd}`}
                  </p>
                )}
              </div>
              {isCancelling && (
                <span className="text-xs text-yellow-400 border border-yellow-400/40 px-2 py-1 rounded">
                  Cancelling
                </span>
              )}
            </div>
          </div>
        )}

        {/* Scan Form */}
        <div className="bg-midnight-light border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Scan a Website</h2>
          <form onSubmit={handleScan} className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="flex-1 rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue transition-all"
            />
            <button
              type="submit"
              disabled={scanning}
              className="rounded-lg bg-accent-blue px-6 py-3 font-semibold text-white hover:bg-accent-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </form>

          {scanMessage && <p className="mt-3 text-sm text-green-400">{scanMessage}</p>}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        {/* Recent Scans */}
        <h2 className="text-xl font-semibold text-white mb-4">Your Reports</h2>
        {recentScans.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            No scans yet. Enter a URL above to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {recentScans.map((scan) => (
              <div key={scan.id} className="bg-midnight-light border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{scan.url || "(no URL)"}</p>
                  <p className="text-white/40 text-sm mt-1">
                    {scan.created_at
                      ? new Date(scan.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich" })
                      : "—"}
                    {" · "}
                    <span className={`capitalize ${
                      scan.status === "completed" ? "text-green-400" :
                      scan.status === "processing" ? "text-yellow-400" :
                      scan.status === "failed" ? "text-red-400" : "text-white/40"
                    }`}>
                      {scan.status}
                    </span>
                  </p>
                </div>
                {scan.status === "completed" && (
                  <a
                    href={`/report/${scan.id}?token=${encodeURIComponent(sessionToken)}`}
                    className="text-sm bg-accent-blue/20 text-accent-blue px-4 py-2 rounded-lg hover:bg-accent-blue/30 transition-all"
                  >
                    View Report
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
