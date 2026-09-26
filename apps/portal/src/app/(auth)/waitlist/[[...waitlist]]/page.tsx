import { Waitlist } from "@clerk/nextjs";

// Sign-ups are closed; visitors request access here and an administrator approves them.
export default function WaitlistPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Waitlist />
    </div>
  );
}
