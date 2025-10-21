FROM node:20-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY packages ./packages

# Build backend
RUN pnpm --filter basil-backend build

# Expose port
EXPOSE 4000

# Create directories for recordings and briefings
RUN mkdir -p /app/recordings /app/briefings

# Start the server
CMD ["pnpm", "--filter", "basil-backend", "start"]
