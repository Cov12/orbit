# WorkPipe — CRM. Used by demo/compose.yaml.
#
# The schema is applied at container start (`prisma db push`), not during the build,
# so the image can be built without a database.

FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Inlined into the client bundle at build time. Leave NEXT_PUBLIC_DOMAIN empty unless
# published sites are served from subdomains of it (see middleware.ts).
ARG NEXT_PUBLIC_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_DOMAIN=
ARG NEXT_PUBLIC_SCHEME=https://
ARG NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT=0
ARG NEXT_PUBLIC_PLATFORM_ONETIME_FEE=0
ARG NEXT_PUBLIC_PLATFORM_BUSINESS_PERCENT=0
ARG NEXT_PUBLIC_PLATFORM_INVOICE_FEE=0
ENV NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL \
    NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN \
    NEXT_PUBLIC_SCHEME=$NEXT_PUBLIC_SCHEME \
    NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT=$NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT \
    NEXT_PUBLIC_PLATFORM_ONETIME_FEE=$NEXT_PUBLIC_PLATFORM_ONETIME_FEE \
    NEXT_PUBLIC_PLATFORM_BUSINESS_PERCENT=$NEXT_PUBLIC_PLATFORM_BUSINESS_PERCENT \
    NEXT_PUBLIC_PLATFORM_INVOICE_FEE=$NEXT_PUBLIC_PLATFORM_INVOICE_FEE
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && exec npx next start -p 3000"]
