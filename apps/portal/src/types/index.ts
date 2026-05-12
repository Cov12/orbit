import type { Plan, SubStatus, MemberRole, AppType } from '@prisma/client';

export type { Plan, SubStatus, MemberRole, AppType };

export interface OrbitJwtPayload {
  sub: string;
  email: string;
  name: string;
  org_id: string;
  org_slug: string;
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
