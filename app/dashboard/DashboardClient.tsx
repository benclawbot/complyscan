"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const checkoutSessionId = searchParams.get('session_id');

  const [email, setEmail] = useState<string | null>(null);
  const [userType, setUserType] = useState<"user" | "subscriber" | null>(null);
  const [credits, setCredits] = useState<number>(0);
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
  const [agencyTab, setAgencyTab] = useState<"clients" | "scans" | "branding">("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientScans, setClientScans] = useState<ClientScan[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [newClientUrl, setNewClientUrl] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [clientError, setClientError] = useState("");
  const [clientSuccess, setClientSuccess] = useState("");
  const [scanningClient, setScanningClient] = useState<string | null>(null);
  const [pendingAutoOpenScanIds, setPendingAutoOpenScanIds] = useState<string[]>([]);

  const [branding, setBranding] = useState<{ agencyName: string; logoDataUrl: string }>({
    agencyName: "",
    logoDataUrl: "",
  });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingStatus, setBrandingStatus] = useState<string>("");

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
          credits?: number;
        }>;
      })
      .then((data) => {
        if (data?.authenticated) {
          setEmail(data.email);
          setUserType(data.type as "user" | "subscriber");
          setCredits(typeof data.credits === 'number' ? data.credits : 0);
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
              loadBranding();
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

  useEffect(() => {
    if (!sessionToken || !checkoutSessionId) return;

    fetch(`/api/stripe/session?session_id=${encodeURIComponent(checkoutSessionId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ purchaseType?: string; currentCredits?: number }>) : null))
      .then((data) => {
        if (data?.purchaseType === 'credits' && typeof data.currentCredits === 'number') {
          setCredits(data.currentCredits);
        }
      })
      .finally(() => {
        const next = new URL(window.location.href);
        next.searchParams.delete('session_id');
        next.searchParams.delete('credits_added');
        window.history.replaceState({}, '', `${next.pathname}${next.search}`);
      })
      .catch(() => {});
  }, [sessionToken, checkoutSessionId]);

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

  const loadBranding = () => {
    fetch("/api/branding", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => res.ok ? (res.json() as Promise<{ branding?: any }>) : null)
      .then((data) => {
        const b = data?.branding;
        if (!b) return;
        setBranding({
          agencyName: b.agencyName || "",
          logoDataUrl: b.logoDataUrl || "",
        });
      })
      .catch(() => {});
  };

  const loadScans = async (type: "user" | "subscriber") => {
    try {
      const endpoint = type === "subscriber" ? "/api/scan/subscriber" : "/api/scan/user";
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json() as { scans?: any[] };
      const scans = Array.isArray(data.scans) ? data.scans : [];
      setRecentScans(scans);
      return scans;
    } catch {
      return [] as any[];
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

  useEffect(() => {
    if (!authenticated || !sessionToken || !userType) return;

    const hasProcessingScan = recentScans.some((scan) => scan.status === 'processing' || scan.status === 'pending');
    const shouldPoll = hasProcessingScan || pendingAutoOpenScanIds.length > 0;
    if (!shouldPoll) return;

    const interval = window.setInterval(async () => {
      const scans = await loadScans(userType);
      if (isAgency) {
        loadClients();
        if (selectedClient?.id) loadClientDetails(selectedClient.id);
      }

      const completedTarget = scans.find((scan: any) => pendingAutoOpenScanIds.includes(scan.id) && scan.status === 'completed');
      if (!completedTarget) return;

      setPendingAutoOpenScanIds((prev) => prev.filter((id) => id !== completedTarget.id));
      const query = isAgency ? '&agency=true' : '';
      window.location.href = `/report/${completedTarget.id}?token=${encodeURIComponent(sessionToken)}${query}`;
    }, 4000);

    return () => window.clearInterval(interval);
  }, [authenticated, sessionToken, userType, recentScans, pendingAutoOpenScanIds, isAgency, selectedClient?.id]);

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
        setScanning(false);
        return;
      }
      setScanMessage("Scan started! The report will appear in your history once ready.");
      setUrl("");
      if (data.scanId) {
        setRecentScans((prev) => [
          { id: data.scanId, url, status: "processing", created_at: new Date().toISOString() },
          ...prev,
        ]);
        setPendingAutoOpenScanIds((prev) => (prev.includes(data.scanId as string) ? prev : [...prev, data.scanId as string]));
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
        setScanning(false);
        return;
      }
      setScanMessage("Scan started! The report will appear below once ready.");
      setUrl("");
      if (data.scanId) {
        setRecentScans((prev) => [
          { id: data.scanId, url, status: "processing", created_at: new Date().toISOString() },
          ...prev,
        ]);
        setPendingAutoOpenScanIds((prev) => (prev.includes(data.scanId as string) ? prev : [...prev, data.scanId as string]));
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

    const data = await res.json() as { error?: string; scanId?: string };
    if (!res.ok) {
      setClientError(data.error || "Scan failed.");
      setScanningClient(null);
      return;
    }

    setClientSuccess("Scan started! The report will appear in client history once ready.");
    if (data.scanId) {
      const client = clients.find((c) => c.id === clientId);
      setRecentScans((prev) => [
        { id: data.scanId, url: client?.url || '(client URL)', status: 'processing', created_at: new Date().toISOString() },
        ...prev,
      ]);
      setPendingAutoOpenScanIds((prev) => (prev.includes(data.scanId as string) ? prev : [...prev, data.scanId as string]));
    }
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

  const handleBuyCredits = async (pack: 'credits_3' | 'credits_10') => {
    try {
      const res = await fetch('/api/stripe/checkout-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ pack }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) {
        alert(data.error || 'Checkout failed.');
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Checkout failed.');
    }
  };

  const handleBrandingLogoFile = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      setBranding((b) => ({ ...b, logoDataUrl: value }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async () => {
    setBrandingStatus('');
    setBrandingSaving(true);
    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          agencyName: branding.agencyName,
          logoDataUrl: branding.logoDataUrl,
        }),
      });
      const data = await res.json().catch(() => ({})) as any;
      if (!res.ok) {
        setBrandingStatus(data.error || 'Failed to save branding.');
        return;
      }
      setBrandingStatus('Saved.');
    } catch {
      setBrandingStatus('Failed to save branding.');
    } finally {
      setBrandingSaving(false);
    }
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
            <button
              onClick={() => setAgencyTab("branding")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                agencyTab === "branding"
                  ? "bg-accent-blue text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Branding
            </button>
          </div>

          {agencyTab === "branding" && (
            <div className="bg-midnight-light border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-2">White-label Branding</h2>
              <p className="text-white/50 text-sm mb-6">Your logo and agency name will appear on PDFs exported for your clients.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/50 text-xs mb-1 uppercase tracking-wider">Agency name</label>
                  <input
                    value={branding.agencyName}
                    onChange={(e) => setBranding((b) => ({ ...b, agencyName: e.target.value }))}
                    className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent-blue transition-all"
                    placeholder="Your agency name"
                  />
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1 uppercase tracking-wider">Logo upload</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBrandingLogoFile(e.target.files?.[0] || null)}
                    className="w-full text-white/70 text-sm"
                  />
                  {branding.logoDataUrl && (
                    <div className="mt-3 bg-midnight border border-white/10 rounded-lg p-3 flex items-center justify-center">
                      <img src={branding.logoDataUrl} alt="Logo preview" style={{ maxHeight: 64, maxWidth: 220 }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={handleSaveBranding}
                  disabled={brandingSaving}
                  className="rounded-lg bg-accent-blue px-6 py-3 font-semibold text-white hover:bg-accent-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {brandingSaving ? "Saving..." : "Save Branding"}
                </button>
                {brandingStatus && <span className="text-white/50 text-sm">{brandingStatus}</span>}
              </div>
            </div>
          )}

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

        {userType === "user" && (
          <div className="bg-midnight-light border border-white/10 rounded-2xl p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Report Credits</h2>
                <p className="text-white/50 text-sm">Credits are used to unlock full reports and PDF downloads.</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-sm">Available</p>
                <p className="text-3xl font-bold text-white">{credits}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button onClick={() => handleBuyCredits('credits_3')} className="rounded-lg bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 transition-all text-sm">
                Buy 3 reports ($29)
              </button>
              <button onClick={() => handleBuyCredits('credits_10')} className="rounded-lg bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 transition-all text-sm">
                Buy 10 reports ($79)
              </button>
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
