"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface InviteDetails {
  orgName: string;
  role: string;
  email: string;
  expired: boolean;
  alreadyAccepted: boolean;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invite details
  useEffect(() => {
    if (!token) return;

    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvite(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load invite");
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async () => {
    if (!isSignedIn) {
      // Redirect to sign-in with return URL
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invite");
        setAccepting(false);
        return;
      }

      // Success - redirect to dashboard with new workspace selected
      router.push(`/dashboard?joined=${data.orgSlug}`);
    } catch {
      setError("Failed to accept invite");
      setAccepting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#2B2FFF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#1a1a1f] rounded-xl border border-white/10 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Invalid Invite</h1>
            <p className="text-gray-400 mb-6">{error || "This invite link is invalid or has expired."}</p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (invite.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#1a1a1f] rounded-xl border border-white/10 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Invite Expired</h1>
            <p className="text-gray-400 mb-6">This invite has expired. Please ask the workspace owner to send a new invite.</p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (invite.alreadyAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#1a1a1f] rounded-xl border border-white/10 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Already Accepted</h1>
            <p className="text-gray-400 mb-6">This invite has already been accepted.</p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-2.5 rounded-lg bg-[#2B2FFF] text-white hover:bg-[#2B2FFF]/90 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="max-w-md w-full mx-4">
        <div className="bg-[#1a1a1f] rounded-xl border border-white/10 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#2B2FFF]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#2B2FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Invited!</h1>
            <p className="text-gray-400">
              You&apos;ve been invited to join <span className="text-white font-medium">{invite.orgName}</span> as {invite.role === "ADMIN" ? "an" : "a"}{" "}
              <span className="text-white font-medium capitalize">{invite.role.toLowerCase()}</span>.
            </p>
          </div>

          {!isSignedIn && (
            <p className="text-sm text-gray-500 text-center mb-6">
              You&apos;ll need to sign in or create an account to accept this invite.
            </p>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-3 rounded-lg bg-[#2B2FFF] text-white font-medium hover:bg-[#2B2FFF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Accepting...
              </span>
            ) : isSignedIn ? (
              "Accept Invite"
            ) : (
              "Sign in to Accept"
            )}
          </button>

          <p className="mt-4 text-xs text-gray-500 text-center">
            By accepting, you&apos;ll gain access to this workspace and its apps.
          </p>
        </div>
      </div>
    </div>
  );
}
