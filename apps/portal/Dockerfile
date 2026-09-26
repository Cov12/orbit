# Portal — identity gate. Used by demo/compose.yaml.
#
# The schema is applied at container start (`prisma db push`), not during the build,
# so the image can be built without a database. Portal owns the schema it shares
# with Drive; Drive never pushes.

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
# Public URLs are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ATRIUM_URL
ARG NEXT_PUBLIC_CONDUCTOR_URL
ARG NEXT_PUBLIC_DRIVE_URL
ARG NEXT_PUBLIC_WORKPIPE_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_ATRIUM_URL=$NEXT_PUBLIC_ATRIUM_URL \
    NEXT_PUBLIC_CONDUCTOR_URL=$NEXT_PUBLIC_CONDUCTOR_URL \
    NEXT_PUBLIC_DRIVE_URL=$NEXT_PUBLIC_DRIVE_URL \
    NEXT_PUBLIC_WORKPIPE_URL=$NEXT_PUBLIC_WORKPIPE_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && exec npx next start -p 3000"]
