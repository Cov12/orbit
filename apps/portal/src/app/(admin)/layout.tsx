// Isolated admin shell — deliberately NOT the (portal) layout: no Clerk, no
// portal sidebar. Auth is enforced per-page via requireAdmin() (the login page
// itself must stay open, so the guard can't live here).
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {children}
    </div>
  );
}
