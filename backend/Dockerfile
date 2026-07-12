## Build stage: compile the backend into a standalone binary.
## Build context is the MONOREPO ROOT (not backend/) so workspace packages
## (@blueprint/*) and the root bun.lock resolve. Build with:
##   docker build -f backend/Dockerfile -t <image> .
FROM oven/bun:1.3.1 AS builder
WORKDIR /app

COPY . .
RUN bun install --frozen-lockfile
RUN bun build backend/src/index.ts --compile --outfile /app/server

## Runtime stage: minimal, non-root base.
## Secrets are fetched in-process via the Bitwarden WASM SDK, embedded in the
## compiled binary — no `bws` CLI or shell is needed in this image. The
## container expects BWS_ACCESS_TOKEN and BWS_ORGANIZATION_ID in its environment.
FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app

COPY --from=builder /app/server /app/server

## Migration SQL + journal. `bun build --compile` embeds only JS/TS imports, not
## loose `.sql` files, and Drizzle's migrator reads them from disk at runtime.
## `/app/server migrate` reads them from this absolute path.
COPY --from=builder /app/backend/src/db/migrations /app/migrations

USER nonroot
ENTRYPOINT ["/app/server"]
