"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();

  // Detect if this is a new user from Clerk invitation
  const isNewUser = searchParams.get("__clerk_status") === "sign_up";
  // Check if we should skip auto-redirect (user came back from auth page)
  const skipAutoRedirect = searchParams.get("manual") === "true";

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

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

  // Auto-redirect: check if email exists in Clerk and redirect to appropriate auth page
  useEffect(() => {
    // Skip if: still loading, already signed in, no invite, or manual mode
    if (!isLoaded || loading || isSignedIn || !invite || skipAutoRedirect) return;
    // Skip if invite has issues
    if (invite.expired || invite.alreadyAccepted) return;

    const checkEmailAndRedirect = async () => {
      setCheckingEmail(true);
      try {
        const res = await fetch(`/api/invites/${token}/check-email`);
        if (!res.ok) {
          setCheckingEmail(false);
          return;
        }
        const data = await res.json();
        const returnUrl = encodeURIComponent(window.location.href + "?manual=true");

        if (data.exists) {
          // User exists in Clerk - redirect to sign-in
          router.push(`/sign-in?redirect_url=${returnUrl}`);
        } else {
          // New user - redirect to sign-up
          router.push(`/sign-up?redirect_url=${returnUrl}`);
        }
      } catch {
        // If check fails, show buttons instead
        setCheckingEmail(false);
      }
    };

    checkEmailAndRedirect();
  }, [isLoaded, loading, isSignedIn, invite, token, router, skipAutoRedirect]);

  const getReturnUrl = () => encodeURIComponent(window.location.href);

  const handleSignUp = () => {
    router.push(`/sign-up?redirect_url=${getReturnUrl()}`);
  };

  const handleSignIn = () => {
    router.push(`/sign-in?redirect_url=${getReturnUrl()}`);
  };

  const handleAccept = async () => {
    if (!isSignedIn) {
      // Default to sign-up for new users from Clerk invitation flow
      if (isNewUser) {
        handleSignUp();
      } else {
        handleSignIn();
      }
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

  if (!isLoaded || loading || checkingEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#2B2FFF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">
            {checkingEmail ? "Preparing your account..." : "Loading invite..."}
          </p>
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

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {isSignedIn ? (
            <>
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
                ) : (
                  "Accept Invite"
                )}
              </button>
              <p className="mt-4 text-xs text-gray-500 text-center">
                This workspace will be added to your account. You can switch between
                workspaces using the dropdown in the sidebar.
              </p>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <button
                  onClick={handleSignIn}
                  className="w-full py-3 rounded-lg bg-[#2B2FFF] text-white font-medium hover:bg-[#2B2FFF]/90 transition-colors"
                >
                  Sign In to Accept
                </button>
                <button
                  onClick={handleSignUp}
                  className="w-full py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors border border-white/10"
                >
                  Create New Account
                </button>
              </div>
              <div className="mt-5 p-3 rounded-lg bg-[#2B2FFF]/5 border border-[#2B2FFF]/20">
                <p className="text-xs text-gray-300 text-center">
                  <span className="font-medium text-white">Already have a Orbit account?</span><br />
                  Sign in to add this workspace to your existing account.
                  You&apos;ll be able to switch between all your workspaces.
                </p>
              </div>
              <p className="mt-3 text-xs text-gray-500 text-center">
                New to Orbit? Click &quot;Create New Account&quot; to get started.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
