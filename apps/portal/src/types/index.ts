import type { Plan, SubStatus, MemberRole, AppType } from '@prisma/client';

export type { Plan, SubStatus, MemberRole, AppType };

export interface OrbitJwtPayload {
  sub: string;
  email: string;
  name: string;
  org_id: string;
  org_slug: string;
  /** Org display name + logo (workspace branding), for apps that provision from the JWT. */
  org_name?: string;
  org_logo?: string | null;
  /** Org industry captured at signup; consumed by downstream onboarding (e.g. Atrium). */
  org_industry?: string | null;
  /**
   * Active sub-account (sub-workspace) id, scoped to org_id. `null`/absent = business
   * scope (the org as a whole). The shared cross-app key apps use to scope data/memory.
   */
  sub_account_id?: string | null;
  role: MemberRole;
  subscriptions: {
    plan: Plan;
    status: SubStatus;
  }[];
  app_access: AppType[];
  aud?: string;
  iat: number;
  exp: number;
}

export interface AppInfo {
  id: AppType;
  name: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  status: 'active' | 'inactive' | 'coming_soon';
}

export interface PlanInfo {
  id: Plan;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  apps: AppType[];
  highlighted?: boolean;
}
