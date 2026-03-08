FROM oven/bun:1-alpine

WORKDIR /app

# Copy workspace root and shared package
COPY package.json bun.lock* ./
COPY packages/shared/ ./packages/shared/
COPY packages/agent/ ./packages/agent/

# Install dependencies
RUN bun install --frozen-lockfile || bun install

WORKDIR /app/packages/agent

# NanoClaw will be cloned and set up here.
# This Dockerfile is a starting point — the actual entrypoint
# depends on NanoClaw's container/agent-runner setup.

CMD ["echo", "Run /setup and /add-telegram inside NanoClaw to configure the agent."]
