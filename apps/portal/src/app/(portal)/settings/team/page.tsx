"use client";

import { useEffect, useState, useCallback } from "react";

interface Member {
  id: string;
  email: string | null;
  name: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  createdAt: string;
  expiresAt: string;
  inviteUrl: string;
}

export default function TeamSettingsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Fetch current workspace first
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        if (data.current) {
          setWorkspaceId(data.current.id);
          setWorkspaceName(data.current.name);
        } else {
          setError("No workspace selected");
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Failed to load workspace");
        setLoading(false);
      });
  }, []);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        fetch(`/api/workspaces/${workspaceId}/invites`),
      ]);

      if (!membersRes.ok) throw new Error("Failed to load members");

      const membersData = await membersRes.json();
      setMembers(membersData.members);
      setCurrentRole(membersData.currentMemberRole);

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        setInvites(invitesData.invites);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      fetchData();
    }
  }, [workspaceId, fetchData]);

  const canManageTeam = currentRole === "OWNER" || currentRole === "ADMIN";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !inviteEmail) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
        setInviting(false);
        return;
      }

      setInviteSuccess({ url: data.invite.inviteUrl, emailSent: data.invite.emailSent });
      setInviteEmail("");
      setInviteRole("MEMBER");
      fetchData(); // Refresh invites list
    } catch {
      setInviteError("Failed to send invite");
    }
    setInviting(false);
  };

  const handleResendInvite = async (inviteId: string) => {
    if (!workspaceId) return;
    setResendingId(inviteId);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        // Update invite in list with new expiration
        setInvites(invites.map((i) =>
          i.id === inviteId ? { ...i, expiresAt: data.expiresAt } : i
        ));
      }
    } catch {
      // Silently fail
    }
    setResendingId(null);
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!workspaceId) return;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setInvites(invites.filter((i) => i.id !== inviteId));
      }
    } catch {
      // Silently fail
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: "MEMBER" | "ADMIN") => {
    if (!workspaceId) return;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setMembers(members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
      }
    } catch {
      // Silently fail
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!workspaceId) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMembers(members.filter((m) => m.id !== memberId));
      }
    } catch {
      // Silently fail
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/5 rounded w-1/4" />
          <div className="h-4 bg-white/5 rounded w-1/2" />
          <div className="h-64 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-gray-400 mt-1">
          Manage members and invites for <span className="text-white">{workspaceName}</span>.
        </p>
      </div>

      {/* Invite Form */}
      {canManageTeam && (
        <div className="glass p-6">
          <h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex gap-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                required
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#2B2FFF]"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "MEMBER" | "ADMIN")}
                className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#2B2FFF]"
              >
                <option value="MEMBER">Member</option>
                {currentRole === "OWNER" && <option value="ADMIN">Admin</option>}
              </select>
              <button
                type="submit"
                disabled={inviting || !inviteEmail}
                className="px-6 py-2.5 rounded-lg bg-[#2B2FFF] text-white font-medium hover:bg-[#2B2FFF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </div>
            {inviteError && (
              <p className="text-sm text-red-400">{inviteError}</p>
            )}
            {inviteSuccess && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
                <p className="text-sm text-green-400">
                  {inviteSuccess.emailSent
                    ? "Invite sent successfully! An email has been sent to the invitee."
                    : "Invite created! Share the link below with the invitee."}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteSuccess.url}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(inviteSuccess.url)}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    {copiedUrl === inviteSuccess.url ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Pending Invites */}
      {canManageTeam && invites.length > 0 && (
        <div className="glass p-6">
          <h2 className="text-lg font-semibold mb-4">Pending Invites</h2>
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="p-3 rounded-lg bg-white/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">{invite.email}</p>
                    <p className="text-sm text-gray-500">
                      {invite.role} · Expires{" "}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResendInvite(invite.id)}
                      disabled={resendingId === invite.id}
                      className="px-3 py-1.5 rounded-lg text-sm text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                      {resendingId === invite.id ? "Sending..." : "Resend"}
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={invite.inviteUrl}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 font-mono"
                  />
                  <button
                    onClick={() => handleCopyUrl(invite.inviteUrl)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors"
                  >
                    {copiedUrl === invite.inviteUrl ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="glass p-6">
        <h2 className="text-lg font-semibold mb-4">Members</h2>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2B2FFF]/20 flex items-center justify-center text-[#2B2FFF] font-medium">
                  {(member.name || member.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {member.name || member.email || "Unknown"}
                  </p>
                  {member.name && member.email && (
                    <p className="text-sm text-gray-500">{member.email}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {member.role === "OWNER" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
                    Owner
                  </span>
                ) : canManageTeam ? (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleUpdateRole(member.id, e.target.value as "MEMBER" | "ADMIN")
                      }
                      disabled={currentRole !== "OWNER" && member.role === "ADMIN"}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none disabled:opacity-50"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={currentRole !== "OWNER" && member.role === "ADMIN"}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove member"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400 capitalize">
                    {member.role.toLowerCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Explanation */}
      <div className="text-sm text-gray-500 space-y-1">
        <p><strong className="text-gray-400">Owner:</strong> Full access, manages billing, cannot be removed</p>
        <p><strong className="text-gray-400">Admin:</strong> Full app access, can invite members</p>
        <p><strong className="text-gray-400">Member:</strong> Access based on workspace subscriptions</p>
      </div>
    </div>
  );
}
