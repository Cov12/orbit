import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const redirectUrl = params.redirect_url;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn
        forceRedirectUrl={redirectUrl || "/dashboard"}
      />
    </div>
  );
}
