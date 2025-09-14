# WorkPipe Technical Implementation Plan

This comprehensive technical implementation plan is based on the PRD and serves as the foundation for all future feature enhancements.

## **Phase 1: Foundation & Infrastructure**

### **1.1 Project Setup & Tooling**
- Next.js 14 with App Router and TypeScript
- ESLint + Prettier configuration
- Husky for git hooks
- Conventional commits setup
- Environment configuration (.env hierarchy)

### **1.2 Development Environment**
```bash
# Core dependencies
- Next.js 14
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL driver
```

### **1.3 Folder Structure**
```
src/
├── app/                     # App Router pages
│   ├── (auth)/             # Authentication pages
│   ├── (main)/             # Protected routes
│   │   ├── business/       # Business management
│   │   └── subaccount/     # Subaccount management
│   ├── [domain]/           # Dynamic domain routing
│   ├── site/               # Marketing pages
│   └── api/                # API routes
├── components/             # Reusable components
├── lib/                    # Utilities & configurations
├── providers/              # Context providers
└── middleware.ts           # Custom middleware
```

## **Phase 2: Database Schema & Multi-Tenancy Strategy**

### **2.1 Multi-Tenancy Architecture**
- **Row-Level Security (RLS)**: Every table includes `businessId` for tenant isolation
- **Hierarchical Structure**: Business → SubAccount → Resources
- **Database Constraints**: Foreign key relationships enforce tenant boundaries
- **Application-Level Checks**: Double verification in API routes

### **2.2 Core Schema Design**

**Identity & Access Management:**
```sql
-- Users (Clerk integration)
User {
  id: String @id @default(cuid())
  clerkUserId: String @unique
  email: String
  name: String?
  avatarUrl: String?
  createdAt: DateTime @default(now())
}

-- Top-level organizations
Business {
  id: String @id @default(cuid())
  name: String
  slug: String @unique
  ownerUserId: String
  stripeCustomerId: String?
  planTier: String @default("STARTER")
  createdAt: DateTime @default(now())

  owner: User @relation(fields: [ownerUserId], references: [id])
}

-- Client/project workspaces
SubAccount {
  id: String @id @default(cuid())
  businessId: String
  name: String
  slug: String
  stripeConnectAccountId: String?
  primaryDomainId: String?
  createdAt: DateTime @default(now())

  business: Business @relation(fields: [businessId], references: [id])
  @@unique([businessId, slug])
}
```

**RBAC System:**
```sql
-- Business-level roles
UserBusinessRole {
  userId: String
  businessId: String
  role: BusinessRole

  @@id([userId, businessId])
}

-- Subaccount-level roles
UserSubAccountRole {
  userId: String
  subAccountId: String
  role: SubAccountRole

  @@id([userId, subAccountId])
}

enum BusinessRole {
  OWNER
  ADMIN
  STAFF
  BILLING_ONLY
}

enum SubAccountRole {
  ADMIN
  USER
  VIEWER
}
```

## **Phase 3: Authentication & Authorization System**

### **3.1 Clerk Integration Strategy**
```typescript
// lib/auth.ts
export const authConfig = {
  clerk: {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/onboarding'
  }
}

// Custom user metadata structure
interface ClerkUserMetadata {
  businessIds: string[]
  currentBusinessId?: string
  currentSubAccountId?: string
}
```

### **3.2 Authorization Middleware**
```typescript
// lib/permissions.ts
export const PERMISSIONS = {
  BUSINESS: {
    BILLING: ['OWNER', 'ADMIN', 'BILLING_ONLY'],
    TEAM_MANAGEMENT: ['OWNER', 'ADMIN'],
    SUBACCOUNT_MANAGEMENT: ['OWNER', 'ADMIN'],
    SETTINGS: ['OWNER', 'ADMIN']
  },
  SUBACCOUNT: {
    FUNNELS: ['ADMIN', 'USER'],
    PIPELINES: ['ADMIN', 'USER'],
    CONTACTS: ['ADMIN', 'USER'],
    MEDIA: ['ADMIN', 'USER'],
    ANALYTICS: ['ADMIN', 'USER', 'VIEWER']
  }
} as const;

// Permission checking utilities
export async function hasBusinessPermission(
  userId: string,
  businessId: string,
  permission: keyof typeof PERMISSIONS.BUSINESS
): Promise<boolean> {
  // Implementation with database lookup
}
```

### **3.3 Session Management**
```typescript
// lib/session.ts
interface UserSession {
  userId: string
  clerkUserId: string
  currentBusinessId: string
  currentSubAccountId?: string
  businessRoles: Record<string, BusinessRole>
  subAccountRoles: Record<string, SubAccountRole>
}

export async function getSessionContext(userId: string): Promise<UserSession> {
  // Fetch user's business and subaccount roles
  // Cache in Redis for performance
}
```

## **Phase 4: Domain Routing & Middleware Architecture**

### **4.1 Domain Resolution Strategy**
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl

  // 1. Handle authentication routes
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
    return NextResponse.next()
  }

  // 2. Resolve domain type
  const domainType = await resolveDomainType(hostname)

  switch (domainType.type) {
    case 'MAIN_APP':
      return handleMainApp(request)
    case 'CUSTOM_DOMAIN':
      return handleCustomDomain(request, domainType.subAccountId)
    case 'SUBDOMAIN':
      return handleSubdomain(request, domainType.subAccountId)
    default:
      return new Response('Domain not found', { status: 404 })
  }
}
```

### **4.2 Domain Mapping Schema**
```sql
Domain {
  id: String @id @default(cuid())
  businessId: String
  subAccountId: String?
  hostname: String @unique  -- e.g., "client.workpipe.orbit.example" or "custom.com"
  verified: Boolean @default(false)
  isPrimary: Boolean @default(false)
  createdAt: DateTime @default(now())

  business: Business @relation(fields: [businessId], references: [id])
  subAccount: SubAccount? @relation(fields: [subAccountId], references: [id])

  @@index([businessId])
  @@index([subAccountId])
}
```

### **4.3 Route Structure**
```typescript
// Route mapping strategy
const ROUTE_PATTERNS = {
  // Main app routes (workpipe.orbit.example)
  MAIN: {
    PUBLIC: ['/site', '/api/webhooks', '/api/uploadthing'],
    AUTH: ['/sign-in', '/sign-up'],
    PROTECTED: ['/business', '/subaccount', '/dashboard']
  },

  // Custom domain routes (client domains)
  CUSTOM: {
    FUNNEL: '/*',           // All paths serve funnel content
    API: '/api/contact',    // Form submissions
    ASSETS: '/assets/*'     // Media files
  }
} as const;
```

### **4.4 Middleware Implementation**
```typescript
// lib/domain-resolver.ts
export async function resolveDomainType(hostname: string) {
  // Cache domain lookups in Redis
  const cached = await redis.get(`domain:${hostname}`)
  if (cached) return JSON.parse(cached)

  // Check if it's the main app domain
  if (hostname === 'workpipe.orbit.example' || hostname === 'localhost:3000') {
    return { type: 'MAIN_APP' }
  }

  // Look up custom domain in database
  const domain = await prisma.domain.findUnique({
    where: { hostname },
    include: { subAccount: true }
  })

  if (!domain) {
    return { type: 'UNKNOWN' }
  }

  const result = {
    type: hostname.endsWith('.workpipe.orbit.example') ? 'SUBDOMAIN' : 'CUSTOM_DOMAIN',
    subAccountId: domain.subAccountId,
    businessId: domain.businessId
  }

  // Cache for 5 minutes
  await redis.setex(`domain:${hostname}`, 300, JSON.stringify(result))
  return result
}
```

## **Phase 5: Core Business Logic & API Structure**

### **5.1 API Architecture Pattern**
```typescript
// API route structure following Next.js 14 App Router
app/api/
├── business/
│   ├── [businessId]/
│   │   ├── route.ts                 # Business CRUD
│   │   ├── billing/route.ts         # Subscription management
│   │   ├── team/route.ts            # Team invitations
│   │   └── subaccounts/route.ts     # Subaccount management
├── subaccount/
│   ├── [subaccountId]/
│   │   ├── funnels/route.ts         # Funnel management
│   │   ├── contacts/route.ts        # Contact management
│   │   ├── pipelines/route.ts       # Pipeline/CRM
│   │   └── media/route.ts           # Media assets
├── webhooks/
│   ├── stripe/route.ts              # Stripe webhooks
│   └── clerk/route.ts               # Clerk webhooks
└── public/
    ├── contact/route.ts             # Form submissions
    └── funnel/[...path]/route.ts    # Funnel page serving
```

### **5.2 Business Logic Services**
```typescript
// lib/services/business.service.ts
export class BusinessService {
  async createBusiness(data: CreateBusinessData, userId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Create business
      const business = await tx.business.create({ data })

      // 2. Assign owner role
      await tx.userBusinessRole.create({
        data: { userId, businessId: business.id, role: 'OWNER' }
      })

      // 3. Create default subscription with Stripe
      const subscription = await stripeService.createSubscription(business.id)

      // 4. Log audit event
      await auditService.log('BUSINESS_CREATED', userId, business.id)

      return business
    })
  }
}

// lib/services/funnel.service.ts
export class FunnelService {
  async publishFunnel(funnelId: string, userId: string) {
    const funnel = await prisma.funnel.update({
      where: { id: funnelId },
      data: { status: 'PUBLISHED', publishedAt: new Date() }
    })

    // Invalidate CDN cache
    await cdnService.invalidateCache(`/funnel/${funnelId}/*`)

    // Trigger automation events
    await eventBus.publish('FUNNEL_PUBLISHED', {
      funnelId,
      subAccountId: funnel.subAccountId,
      userId
    })

    return funnel
  }
}
```

### **5.3 Event-Driven Architecture**
```typescript
// lib/events/event-bus.ts
interface EventDefinition {
  'FUNNEL_PUBLISHED': { funnelId: string; subAccountId: string; userId: string }
  'CONTACT_CREATED': { contactId: string; source: string }
  'PAYMENT_SUCCEEDED': { transactionId: string; amount: number }
  'TICKET_ASSIGNED': { ticketId: string; assigneeId: string }
}

export class EventBus {
  async publish<T extends keyof EventDefinition>(
    type: T,
    payload: EventDefinition[T]
  ) {
    // Store event
    await prisma.event.create({
      data: {
        type,
        payload: payload as any,
        status: 'PENDING'
      }
    })

    // Process immediately or queue
    await this.processEvent(type, payload)
  }

  private async processEvent<T extends keyof EventDefinition>(
    type: T,
    payload: EventDefinition[T]
  ) {
    const handlers = this.getHandlers(type)

    for (const handler of handlers) {
      try {
        await handler(payload)
      } catch (error) {
        // Log error and retry logic
        await this.handleEventError(type, payload, error)
      }
    }
  }
}
```

### **5.4 Data Access Layer**
```typescript
// lib/repositories/base.repository.ts
export abstract class BaseRepository<T> {
  constructor(protected model: any) {}

  async findByBusinessId(businessId: string, options?: FindOptions) {
    return await this.model.findMany({
      where: { businessId, ...options?.where },
      ...options
    })
  }

  async findBySubAccountId(subAccountId: string, options?: FindOptions) {
    return await this.model.findMany({
      where: { subAccountId, ...options?.where },
      ...options
    })
  }

  // Tenant-scoped operations
  async create(data: any, tenantId: string) {
    return await this.model.create({
      data: { ...data, businessId: tenantId }
    })
  }
}

// lib/repositories/funnel.repository.ts
export class FunnelRepository extends BaseRepository<Funnel> {
  constructor() {
    super(prisma.funnel)
  }

  async findPublishedByDomain(domain: string) {
    return await prisma.funnel.findFirst({
      where: {
        status: 'PUBLISHED',
        subAccount: {
          domains: { some: { hostname: domain } }
        }
      },
      include: { steps: { orderBy: { order: 'asc' } } }
    })
  }
}
```

## **Phase 6: UI/UX Component Architecture**

### **6.1 Design System Foundation**
```typescript
// components/ui/ (shadcn/ui base components)
├── button.tsx
├── input.tsx
├── card.tsx
├── dialog.tsx
├── dropdown-menu.tsx
└── ... (other shadcn primitives)

// components/shared/ (custom reusable components)
├── data-table/
│   ├── data-table.tsx
│   ├── data-table-pagination.tsx
│   └── data-table-filters.tsx
├── forms/
│   ├── form-builder.tsx
│   ├── field-components/
│   └── validation/
└── layout/
    ├── sidebar.tsx
    ├── header.tsx
    └── breadcrumbs.tsx
```

### **6.2 Feature-Specific Component Architecture**
```typescript
// Funnel Builder Components
components/funnel-builder/
├── editor/
│   ├── canvas.tsx              # Drag-drop canvas
│   ├── toolbar.tsx             # Tool palette
│   ├── properties-panel.tsx    # Element properties
│   ├── layers-panel.tsx        # Layer hierarchy
│   └── preview-modal.tsx       # Responsive preview
├── elements/
│   ├── text-element.tsx
│   ├── image-element.tsx
│   ├── form-element.tsx
│   ├── video-element.tsx
│   └── stripe-checkout.tsx
└── hooks/
    ├── use-editor-state.tsx
    ├── use-drag-drop.tsx
    └── use-undo-redo.tsx

// CRM Components
components/crm/
├── pipeline/
│   ├── kanban-board.tsx
│   ├── ticket-card.tsx
│   ├── lane-column.tsx
│   └── drag-overlay.tsx
├── contacts/
│   ├── contact-table.tsx
│   ├── contact-form.tsx
│   └── contact-details.tsx
└── shared/
    ├── activity-feed.tsx
    └── assignee-selector.tsx
```

### **6.3 State Management Architecture**
```typescript
// lib/store/ (Zustand stores)
├── editor-store.ts
├── business-store.ts
├── notifications-store.ts
└── theme-store.ts

// Editor state example
interface EditorState {
  elements: FunnelElement[]
  selectedElementId: string | null
  history: EditorHistory
  previewMode: 'desktop' | 'tablet' | 'mobile'

  // Actions
  addElement: (element: FunnelElement) => void
  updateElement: (id: string, updates: Partial<FunnelElement>) => void
  selectElement: (id: string) => void
  undo: () => void
  redo: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  elements: [],
  selectedElementId: null,
  history: { past: [], future: [] },
  previewMode: 'desktop',

  addElement: (element) => set((state) => {
    const newState = { ...state, elements: [...state.elements, element] }
    return addToHistory(newState, 'ADD_ELEMENT')
  }),
  // ... other actions
}))
```

### **6.4 Responsive Design System**
```typescript
// lib/design-tokens.ts
export const designTokens = {
  colors: {
    primary: 'hsl(var(--primary))',
    secondary: 'hsl(var(--secondary))',
    // ... following shadcn color system
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    // ... consistent spacing scale
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
} as const

// components/shared/responsive-container.tsx
interface ResponsiveContainerProps {
  children: React.ReactNode
  maxWidth?: keyof typeof designTokens.breakpoints
  padding?: keyof typeof designTokens.spacing
}

export function ResponsiveContainer({
  children,
  maxWidth = 'xl',
  padding = 'md'
}: ResponsiveContainerProps) {
  return (
    <div className={cn(
      'mx-auto w-full',
      `max-w-${maxWidth}`,
      `p-${padding}`
    )}>
      {children}
    </div>
  )
}
```

### **6.5 Accessibility Implementation**
```typescript
// lib/accessibility.ts
export const a11y = {
  // ARIA labels and roles
  landmarks: {
    navigation: 'navigation',
    main: 'main',
    complementary: 'complementary'
  },

  // Keyboard navigation
  keyboardShortcuts: {
    'ctrl+z': 'undo',
    'ctrl+y': 'redo',
    'escape': 'deselect',
    'delete': 'removeElement'
  },

  // Screen reader announcements
  announcements: {
    elementAdded: 'Element added to canvas',
    elementDeleted: 'Element removed from canvas',
    elementSelected: 'Element selected'
  }
}

// Custom hook for screen reader announcements
export function useScreenReader() {
  const announce = useCallback((message: string) => {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message

    document.body.appendChild(announcement)
    setTimeout(() => document.body.removeChild(announcement), 1000)
  }, [])

  return { announce }
}
```

## **Phase 7: External Integrations Strategy**

### **7.1 Stripe Integration Architecture**
```typescript
// lib/integrations/stripe/
├── client.ts                   # Stripe client configuration
├── subscriptions.service.ts    # Business billing
├── connect.service.ts          # Subaccount Connect accounts
├── webhooks.service.ts         # Webhook processing
├── products.service.ts         # Product/pricing management
└── invoices.service.ts         # Invoice handling

// Stripe Connect Implementation
export class StripeConnectService {
  async createConnectAccount(subAccountId: string, businessId: string) {
    const account = await this.stripe.accounts.create({
      type: 'standard',
      metadata: { subAccountId, businessId }
    })

    // Store account ID
    await prisma.subAccount.update({
      where: { id: subAccountId },
      data: { stripeConnectAccountId: account.id }
    })

    return account
  }

  async createConnectOnboardingUrl(accountId: string, returnUrl: string) {
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.APP_URL}/subaccount/stripe/refresh`,
      return_url: returnUrl,
      type: 'account_onboarding'
    })

    return accountLink.url
  }

  async processPaymentWithFees(
    paymentIntentId: string,
    subAccountId: string,
    platformFeePercent: number
  ) {
    const subAccount = await prisma.subAccount.findUnique({
      where: { id: subAccountId },
      include: { business: true }
    })

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId)
    const platformFee = Math.round(paymentIntent.amount * platformFeePercent / 100)

    // Transfer to connected account minus platform fee
    await this.stripe.transfers.create({
      amount: paymentIntent.amount - platformFee,
      currency: paymentIntent.currency,
      destination: subAccount.stripeConnectAccountId
    })

    // Record transaction
    await prisma.transaction.create({
      data: {
        subAccountId,
        amount: paymentIntent.amount,
        platformFee,
        stripeChargeId: paymentIntent.charges.data[0].id,
        type: 'PAYMENT'
      }
    })
  }
}
```

### **7.2 UploadThing Integration**
```typescript
// lib/integrations/uploadthing/
├── config.ts
├── upload-router.ts
└── file-manager.service.ts

// Upload configuration
export const uploadConfig = {
  image: {
    maxFileSize: '4MB',
    maxFileCount: 10,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  },
  document: {
    maxFileSize: '16MB',
    maxFileCount: 5,
    allowedTypes: ['application/pdf', 'text/plain', 'application/msword']
  },
  video: {
    maxFileSize: '64MB',
    maxFileCount: 3,
    allowedTypes: ['video/mp4', 'video/webm']
  }
} as const

export class FileManagerService {
  async uploadAsset(
    file: File,
    subAccountId: string,
    folder?: string
  ): Promise<MediaAsset> {
    // Upload to UploadThing
    const uploadResult = await utapi.uploadFiles([file])

    if (!uploadResult.data) {
      throw new Error('Upload failed')
    }

    // Store metadata in database
    const asset = await prisma.mediaAsset.create({
      data: {
        subAccountId,
        key: uploadResult.data.key,
        url: uploadResult.data.url,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        folder
      }
    })

    return asset
  }

  async deleteAsset(assetId: string) {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: assetId }
    })

    if (asset) {
      // Delete from UploadThing
      await utapi.deleteFiles([asset.key])

      // Delete from database
      await prisma.mediaAsset.delete({
        where: { id: assetId }
      })
    }
  }
}
```

### **7.3 Webhook Management System**
```typescript
// lib/webhooks/
├── handlers/
│   ├── stripe.handler.ts
│   ├── clerk.handler.ts
│   └── uploadthing.handler.ts
├── webhook-manager.ts
└── verification.ts

export class WebhookManager {
  private handlers = new Map<string, WebhookHandler>()

  register(source: string, handler: WebhookHandler) {
    this.handlers.set(source, handler)
  }

  async process(source: string, event: any, signature?: string) {
    const handler = this.handlers.get(source)
    if (!handler) {
      throw new Error(`No handler for ${source}`)
    }

    // Verify webhook signature
    if (signature && !await this.verifySignature(source, event, signature)) {
      throw new Error('Invalid webhook signature')
    }

    // Process with retry logic
    return await this.withRetry(() => handler.handle(event), 3)
  }

  private async withRetry(fn: () => Promise<any>, attempts: number) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn()
      } catch (error) {
        if (i === attempts - 1) throw error
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
      }
    }
  }
}

// Stripe webhook handler
export class StripeWebhookHandler implements WebhookHandler {
  async handle(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object)
        break
      case 'invoice.payment_failed':
        await this.handlePaymentFailure(event.data.object)
        break
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object)
        break
      default:
        console.log(`Unhandled event: ${event.type}`)
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    // Update transaction status
    // Trigger automation events
    // Send notifications
  }
}
```

### **7.4 Third-Party Service Abstractions**
```typescript
// lib/services/email.service.ts
export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>
  sendTemplate(to: string, templateId: string, variables: Record<string, any>): Promise<void>
}

// Could be implemented with SendGrid, Resend, etc.
export class EmailService implements EmailProvider {
  async sendEmail(to: string, subject: string, body: string) {
    // Implementation depends on provider
  }
}

// lib/services/analytics.service.ts
export class AnalyticsService {
  async trackEvent(event: string, properties: Record<string, any>) {
    // Send to GA4, Mixpanel, etc.
    if (process.env.NODE_ENV === 'production') {
      await this.sendToGA4(event, properties)
    }
  }

  async trackFunnelView(funnelId: string, stepPath: string, userId?: string) {
    await this.trackEvent('funnel_view', {
      funnel_id: funnelId,
      step_path: stepPath,
      user_id: userId,
      timestamp: new Date().toISOString()
    })
  }
}
```

## **Phase 8: Testing & Quality Assurance Strategy**

### **8.1 Testing Framework Architecture**
```typescript
// Testing stack configuration
{
  "unit": ["Vitest", "React Testing Library"],
  "integration": ["Vitest", "Supertest", "Test Database"],
  "e2e": ["Playwright"],
  "performance": ["Artillery", "Lighthouse CI"],
  "security": ["OWASP ZAP", "Snyk"],
  "accessibility": ["axe-core", "Pa11y"]
}

// __tests__/
├── unit/
│   ├── components/
│   ├── services/
│   ├── utils/
│   └── hooks/
├── integration/
│   ├── api/
│   ├── database/
│   └── webhooks/
├── e2e/
│   ├── business-flows/
│   ├── subaccount-flows/
│   └── funnel-builder/
└── security/
    ├── tenant-isolation/
    ├── rbac/
    └── data-leakage/
```

### **8.2 Multi-Tenant Testing Strategy**
```typescript
// __tests__/utils/tenant-test-helpers.ts
export class TenantTestHelper {
  static async createTestBusiness(name = 'Test Business') {
    const business = await prisma.business.create({
      data: {
        name,
        slug: `test-${Date.now()}`,
        ownerUserId: await this.createTestUser(),
        planTier: 'STARTER'
      }
    })

    return business
  }

  static async createTestSubAccount(businessId: string) {
    const subAccount = await prisma.subAccount.create({
      data: {
        businessId,
        name: 'Test SubAccount',
        slug: `test-sub-${Date.now()}`
      }
    })

    return subAccount
  }

  static async assertTenantIsolation(
    businessId1: string,
    businessId2: string,
    entityType: string
  ) {
    // Verify that business1 cannot access business2's data
    const business1Data = await this.getBusinessData(businessId1, entityType)
    const business2Data = await this.getBusinessData(businessId2, entityType)

    expect(business1Data).not.toContain(business2Data)
    expect(business2Data).not.toContain(business1Data)
  }
}

// Security-focused tests
describe('Tenant Isolation', () => {
  test('should prevent cross-tenant data access', async () => {
    const business1 = await TenantTestHelper.createTestBusiness('Business 1')
    const business2 = await TenantTestHelper.createTestBusiness('Business 2')

    // Create data for each business
    const contact1 = await prisma.contact.create({
      data: { businessId: business1.id, name: 'Contact 1', email: 'c1@test.com' }
    })

    const contact2 = await prisma.contact.create({
      data: { businessId: business2.id, name: 'Contact 2', email: 'c2@test.com' }
    })

    // Verify isolation
    await TenantTestHelper.assertTenantIsolation(
      business1.id,
      business2.id,
      'contacts'
    )
  })
})
```

### **8.3 API Testing Strategy**
```typescript
// __tests__/integration/api/business.test.ts
describe('Business API', () => {
  let testBusiness: Business
  let authToken: string

  beforeEach(async () => {
    testBusiness = await TenantTestHelper.createTestBusiness()
    authToken = await getTestAuthToken(testBusiness.ownerUserId)
  })

  test('POST /api/business/:businessId/subaccounts', async () => {
    const response = await request(app)
      .post(`/api/business/${testBusiness.id}/subaccounts`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'New SubAccount',
        slug: 'new-subaccount'
      })
      .expect(201)

    expect(response.body).toMatchObject({
      name: 'New SubAccount',
      businessId: testBusiness.id
    })

    // Verify database state
    const subAccount = await prisma.subAccount.findUnique({
      where: { id: response.body.id }
    })
    expect(subAccount).toBeTruthy()
    expect(subAccount.businessId).toBe(testBusiness.id)
  })

  test('should reject unauthorized access', async () => {
    const otherBusiness = await TenantTestHelper.createTestBusiness('Other')

    await request(app)
      .get(`/api/business/${otherBusiness.id}/subaccounts`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(403)
  })
})
```

### **8.4 E2E Testing Framework**
```typescript
// __tests__/e2e/funnel-builder.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Funnel Builder', () => {
  test('should create and publish a complete funnel', async ({ page }) => {
    // Setup test data
    const { business, subAccount, user } = await setupTestTenant()

    // Login
    await page.goto('/sign-in')
    await page.fill('[name=email]', user.email)
    await page.fill('[name=password]', 'testpassword')
    await page.click('button[type=submit]')

    // Navigate to funnel builder
    await page.goto(`/subaccount/${subAccount.id}/funnels/new`)

    // Create funnel
    await page.fill('[name=name]', 'Test Funnel')
    await page.click('button:has-text("Create Funnel")')

    // Add elements via drag and drop
    await page.dragAndDrop(
      '[data-testid="text-element"]',
      '[data-testid="canvas"]'
    )

    // Configure element
    await page.click('[data-testid="element-0"]')
    await page.fill('[data-testid="text-content"]', 'Welcome to our funnel!')

    // Preview responsiveness
    await page.click('[data-testid="preview-tablet"]')
    await expect(page.locator('[data-testid="canvas"]')).toHaveClass(/tablet/)

    // Publish
    await page.click('button:has-text("Publish")')
    await expect(page.locator('.toast')).toContainText('Funnel published')

    // Verify public access
    const funnelUrl = await page.locator('[data-testid="funnel-url"]').textContent()
    await page.goto(funnelUrl)
    await expect(page.locator('text=Welcome to our funnel!')).toBeVisible()
  })
})
```

### **8.5 Performance Testing Strategy**
```typescript
// performance/load-test.yml (Artillery config)
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Load test"
    - duration: 60
      arrivalRate: 100
      name: "Spike test"

scenarios:
  - name: "Multi-tenant API load"
    weight: 40
    flow:
      - post:
          url: "/api/auth/signin"
          json:
            email: "{{ $randomEmail() }}"
            password: "testpassword"
        capture:
          - json: "$.token"
            as: "authToken"
      - get:
          url: "/api/business/{{ businessId }}/subaccounts"
          headers:
            Authorization: "Bearer {{ authToken }}"

  - name: "Funnel page serving"
    weight: 60
    flow:
      - get:
          url: "/{{ $randomDomain() }}/landing"
        think: 2
```

### **8.6 Quality Gates & CI Pipeline**
```yaml
# .github/workflows/quality-checks.yml
name: Quality Checks

on: [push, pull_request]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint
      - run: npm run type-check

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run test:unit -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Snyk
        uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high

  accessibility-audit:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: npm run start &
      - run: npx pa11y-ci --sitemap http://localhost:3000/sitemap.xml
```

## **Phase 9: Deployment & DevOps Pipeline**

### **9.1 Infrastructure Architecture**
```yaml
# infrastructure/docker-compose.yml (Development)
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: workpipe_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### **9.2 Production Infrastructure (Vercel + Neon)**
```typescript
// infrastructure/vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "next.config.mjs",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/site/(.*)",
      "dest": "/site/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1",
      "headers": {
        "Cache-Control": "public, max-age=31536000, immutable"
      },
      "continue": true
    }
  ],
  "functions": {
    "app/api/webhooks/stripe/route.ts": {
      "maxDuration": 30
    }
  },
  "env": {
    "DATABASE_URL": "@database_url",
    "REDIS_URL": "@redis_url",
    "STRIPE_SECRET_KEY": "@stripe_secret_key"
  }
}

// Environment configuration
const environments = {
  development: {
    database: 'Local PostgreSQL',
    redis: 'Local Redis',
    storage: 'Local UploadThing',
    monitoring: 'Console logs'
  },
  staging: {
    database: 'Neon (staging)',
    redis: 'Upstash Redis',
    storage: 'UploadThing (staging)',
    monitoring: 'Sentry + Vercel Analytics'
  },
  production: {
    database: 'Neon (production) + Read Replicas',
    redis: 'Upstash Redis (clustered)',
    storage: 'UploadThing (production)',
    monitoring: 'Sentry + Vercel Analytics + Custom metrics'
  }
}
```

### **9.3 Database Migration Strategy**
```typescript
// scripts/migrate.ts
import { PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class MigrationManager {
  private prisma = new PrismaClient()

  async runMigrations() {
    console.log('🚀 Starting database migrations...')

    try {
      // Run Prisma migrations
      await execAsync('npx prisma migrate deploy')

      // Run custom data migrations
      await this.runCustomMigrations()

      // Verify migration success
      await this.verifyMigrations()

      console.log('✅ Migrations completed successfully')
    } catch (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }
  }

  private async runCustomMigrations() {
    const migrations = [
      this.backfillBusinessStripeCustomers,
      this.updateLegacyFunnelStructure,
      this.migrateUserRoles
    ]

    for (const migration of migrations) {
      await migration()
    }
  }

  private async backfillBusinessStripeCustomers() {
    const businesses = await this.prisma.business.findMany({
      where: { stripeCustomerId: null }
    })

    for (const business of businesses) {
      // Create Stripe customer for existing businesses
      const customer = await stripe.customers.create({
        email: business.ownerEmail,
        metadata: { businessId: business.id }
      })

      await this.prisma.business.update({
        where: { id: business.id },
        data: { stripeCustomerId: customer.id }
      })
    }
  }
}
```

### **9.4 Monitoring & Observability**
```typescript
// lib/monitoring/metrics.ts
export class MetricsCollector {
  private static instance: MetricsCollector

  static getInstance() {
    if (!this.instance) {
      this.instance = new MetricsCollector()
    }
    return this.instance
  }

  // Performance metrics
  async recordApiLatency(endpoint: string, duration: number, statusCode: number) {
    await this.sendMetric('api.latency', duration, {
      endpoint,
      status_code: statusCode,
      timestamp: Date.now()
    })
  }

  // Business metrics
  async recordFunnelView(funnelId: string, subAccountId: string) {
    await this.sendMetric('funnel.view', 1, {
      funnel_id: funnelId,
      subaccount_id: subAccountId
    })
  }

  async recordConversion(funnelId: string, value: number) {
    await this.sendMetric('funnel.conversion', value, {
      funnel_id: funnelId
    })
  }

  // System health metrics
  async recordDatabaseConnectionPool() {
    const stats = await this.getDatabasePoolStats()
    await this.sendMetric('database.pool.active', stats.active)
    await this.sendMetric('database.pool.idle', stats.idle)
  }

  private async sendMetric(name: string, value: number, tags?: Record<string, any>) {
    // Send to monitoring service (DataDog, New Relic, etc.)
    if (process.env.NODE_ENV === 'production') {
      await fetch(`${process.env.METRICS_ENDPOINT}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value, tags, timestamp: Date.now() })
      })
    }
  }
}
```

### **9.5 CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run test:integration

      - name: Security Scan
        uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high

  database-checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - name: Run Migrations (Test)
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      - name: Generate Prisma Client
        run: npx prisma generate
      - name: Seed Test Data
        run: npm run db:seed:test

  preview-deployment:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    needs: [quality-checks, database-checks]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - name: Deploy to Preview
        run: npx vercel deploy --token=${{ secrets.VERCEL_TOKEN }}

      - name: Run E2E Tests
        run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ steps.deploy.outputs.url }}

  production-deployment:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [quality-checks, database-checks]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - name: Build Application
        run: npm run build

      - name: Deploy to Production
        run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Run Database Migrations
        run: npm run db:migrate:prod
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Smoke Tests
        run: npm run test:smoke
        env:
          TEST_URL: https://workpipe.orbit.example

      - name: Notify Team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed!'
```

### **9.6 Backup & Disaster Recovery**
```typescript
// scripts/backup.ts
export class BackupManager {
  async createDatabaseBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `workpipe-backup-${timestamp}`

    // Create Neon backup (using their API)
    const backup = await fetch(`https://console.neon.tech/api/v2/projects/${process.env.NEON_PROJECT_ID}/backups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEON_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: backupName })
    })

    // Store backup metadata
    await this.recordBackup(backupName, 'database')
  }

  async testRestoreProcedure() {
    // Create test database from backup
    // Run automated tests against restored data
    // Verify data integrity
    // Clean up test resources
  }
}

// Automated backup scheduling (cron job or GitHub Actions)
# .github/workflows/backup.yml
name: Daily Backup
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - run: node scripts/backup.js
      - run: node scripts/test-restore.js
```

## **Implementation Roadmap & Sequencing**

### **Development Phases (Based on PRD Milestones)**

**🎯 Phase M0 - Foundation (Weeks 1-4)**
```
Priority 1: Core Infrastructure
├── Project setup (Next.js 14, TypeScript, Tailwind)
├── Database schema design & Prisma setup
├── Clerk authentication integration
├── Basic RBAC system
├── Domain routing middleware
└── Marketing site structure

Key Deliverables:
- Working authentication flow
- Multi-tenant database structure
- Domain routing for subdomains
- Basic business/subaccount creation
```

**🎯 Phase M1 - Business Billing (Weeks 5-8)**
```
Priority 1: Stripe Integration
├── Business subscription management
├── Add-on catalog and billing
├── Invoice history UI
├── Payment method management
├── Webhook processing
└── Transaction recording

Key Deliverables:
- Complete billing dashboard
- Subscription lifecycle management
- Failed payment handling
- Add-on enable/disable functionality
```

**🎯 Phase M2 - Subaccount Management (Weeks 9-12)**
```
Priority 1: Multi-tenant Operations
├── Subaccount onboarding flow
├── Stripe Connect integration
├── Team invitation system
├── Role-based permissions
├── Domain assignment
└── Basic dashboard

Key Deliverables:
- Subaccount creation and management
- Connect account linking
- Team member invitations
- Permission enforcement
```

**🎯 Phase M3 - Funnel Builder MVP (Weeks 13-18)**
```
Priority 1: Page Builder Core
├── Drag-and-drop editor
├── Component library (Text, Image, Form, Video)
├── Responsive preview system
├── Properties panel
├── Publishing system
└── Public funnel serving

Key Deliverables:
- Working funnel builder
- Responsive design system
- Form submission handling
- Public funnel pages
```

**🎯 Phase M4 - CRM & Contacts (Weeks 19-22)**
```
Priority 1: Pipeline Management
├── Contact management system
├── Kanban pipeline builder
├── Ticket creation and assignment
├── Drag-and-drop functionality
├── Activity tracking
└── Basic reporting

Key Deliverables:
- Complete CRM interface
- Pipeline management
- Contact lifecycle tracking
- Team collaboration features
```

**🎯 Phase M5 - Media & Automation (Weeks 23-26)**
```
Priority 1: Asset Management
├── UploadThing integration
├── Media browser component
├── File organization system
├── Event-driven automation
├── Notification system
└── Audit logging

Key Deliverables:
- Media management system
- Basic automation triggers
- Notification infrastructure
- Complete audit trail
```

### **Critical Success Factors**

**1. Multi-Tenancy First**
- Every feature must enforce tenant boundaries
- Database queries must include tenant filtering
- UI components must respect permission levels

**2. Performance Considerations**
- Implement Redis caching early for domain resolution
- Use React Server Components where appropriate
- Optimize database queries with proper indexing

**3. Security Foundation**
- Implement comprehensive RBAC from day one
- Validate tenant access on every API request
- Use Stripe hosted elements for payment data

**4. Scalability Patterns**
- Design API endpoints for horizontal scaling
- Implement proper connection pooling
- Use CDN for static assets and media

### **Technology Stack Summary**

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 + TypeScript | Application framework |
| **Styling** | Tailwind CSS + shadcn/ui | Design system |
| **Database** | PostgreSQL + Prisma | Data persistence |
| **Auth** | Clerk | Authentication & user management |
| **Payments** | Stripe + Connect | Billing & marketplace |
| **Storage** | UploadThing | File uploads & CDN |
| **Hosting** | Vercel | Application deployment |
| **Monitoring** | Sentry + Vercel Analytics | Error tracking & metrics |
| **Testing** | Vitest + Playwright | Quality assurance |

### **Risk Mitigation Strategies**

**Technical Risks:**
- **Multi-tenant data leakage**: Comprehensive testing strategy with tenant isolation tests
- **Performance degradation**: Early performance monitoring and optimization
- **Third-party dependencies**: Abstraction layers for external services

**Business Risks:**
- **Stripe complexity**: Thorough webhook testing and error handling
- **Domain routing issues**: Comprehensive middleware testing
- **User experience**: Early user testing and feedback loops

This implementation plan provides a solid foundation for building WorkPipe as described in your PRD. The modular approach allows for iterative development while ensuring each phase builds upon the previous foundation. The emphasis on multi-tenancy, security, and performance from the beginning will prevent costly refactoring later in the development process.