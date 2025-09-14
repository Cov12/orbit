# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- **Development server**: `npm run dev` - Start Next.js development server on http://localhost:3000
- **Build**: `npm run build` - Create production build
- **Production server**: `npm run start` - Start production server (requires build first)

### Code Quality & Formatting
- **Lint**: `npm run lint` - Run ESLint for code quality checks
- **Lint (fix)**: `npm run lint:fix` - Run ESLint and automatically fix issues
- **Format**: `npm run format` - Format code with Prettier
- **Format (check)**: `npm run format:check` - Check if code is formatted correctly
- **Type check**: `npm run type-check` - Run TypeScript type checking without emitting files

### Database Commands
- **Generate Prisma client**: `npm run db:generate` - Generate Prisma client after schema changes
- **Push schema**: `npm run db:push` - Push schema changes to database (dev/testing)
- **Create migration**: `npm run db:migrate` - Create and apply database migration
- **Database studio**: `npm run db:studio` - Open Prisma Studio for database management

### Git & Commits
- **Interactive commit**: `npm run commit` - Use commitizen for conventional commits with guided prompts

### Development Workflow
1. Use `npm run dev` to start development server
2. Make code changes
3. Run `npm run format` to format code (or let pre-commit hooks handle it)
4. Run `npm run lint:fix` to fix linting issues
5. Run `npm run type-check` to verify TypeScript
6. Use `npm run commit` for conventional commits or commit normally (commitlint will validate)

## Architecture Overview

WorkPipe is a Next.js 14 business management platform with multi-tenant architecture supporting businesses and subaccounts.

### Core Architecture

- **Framework**: Next.js 14 with App Router
- **Authentication**: Clerk for user management
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **File Uploads**: UploadThing
- **Payments**: Stripe integration
- **Charts**: Tremor React for data visualization

### Multi-Tenant Structure

The application has a complex routing structure supporting:

1. **Site pages** (`/site`) - Public marketing pages
2. **Business management** (`/business`) - Top-level business operations
3. **Subaccount management** (`/subaccount`) - Individual client/project spaces
4. **Dynamic domains** (`/[domain]`) - Custom subdomain routing for funnels

### Key Route Groups

- `(main)` - Protected authenticated routes
- `(auth)` - Authentication pages using Clerk
- Business routes: `/business/[businessId]/*`
- Subaccount routes: `/subaccount/[subaccountId]/*`

### Database Schema

The Prisma schema defines a hierarchical structure:
- **Business** (top-level organization)
- **SubAccount** (client/project workspaces)
- **Users** with role-based permissions
- **Funnels/Profiles** for landing pages
- **Pipelines/Tickets** for CRM functionality
- **Media/Documents/Invoices** for asset management

### Middleware

Custom middleware handles:
- Authentication with Clerk
- Subdomain routing for custom domains
- Route protection and redirects

### Key Features

- **Funnel Builder**: Drag-and-drop page editor
- **Pipeline Management**: CRM with tickets and lanes
- **Media Management**: File uploads and organization
- **Billing**: Stripe subscription management
- **Team Management**: User roles and permissions
- **Automation**: Triggers and actions

### Component Architecture

- Uses shadcn/ui for base components
- Custom components in `src/components/`
- Page-specific components in `_components` subdirectories
- Providers for theming and modals

### Development Tooling

- **ESLint**: Code linting with TypeScript support, import ordering, and unused import detection
- **Prettier**: Code formatting with Tailwind CSS class sorting
- **Husky**: Git hooks for pre-commit linting and commit message validation
- **Commitlint**: Conventional commit message validation
- **lint-staged**: Run linters on staged files only
- **Commitizen**: Interactive commit message generation

### Environment Requirements

- Node.js (compatible with Next.js 14)
- PostgreSQL database
- Clerk authentication setup
- Stripe payment processing
- UploadThing for file uploads

### Environment Setup

1. Copy `.env.local.example` to `.env.local` and fill in your values
2. The project uses environment variable hierarchy: `.env.local` > `.env` > defaults
3. Never commit sensitive environment variables - they're in `.gitignore`