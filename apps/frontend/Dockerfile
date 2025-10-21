FROM node:20-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/frontend ./apps/frontend
COPY packages ./packages

# Build frontend
RUN pnpm --filter frontend build

# Expose port
EXPOSE 3000

# Start the server
CMD ["pnpm", "--filter", "frontend", "start"]
