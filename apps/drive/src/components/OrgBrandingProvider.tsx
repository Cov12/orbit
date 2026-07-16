"use client";

import { createContext, useContext } from "react";

export type OrgBranding = {
  /** Public org logo URL, or null when the token carries no logo. */
  logo: string | null;
  /** Public org display name, or "" when absent. */
  name: string;
};

const OrgBrandingContext = createContext<OrgBranding>({ logo: null, name: "" });

/**
 * Carries server-verified org branding (from the Portal JWT) into the client
 * component tree so client components like TopBar can render it.
 */
export function OrgBrandingProvider({
  logo,
  name,
  children,
}: OrgBranding & { children: React.ReactNode }) {
  return (
    <OrgBrandingContext.Provider value={{ logo, name }}>
      {children}
    </OrgBrandingContext.Provider>
  );
}

export function useOrgBranding(): OrgBranding {
  return useContext(OrgBrandingContext);
}
