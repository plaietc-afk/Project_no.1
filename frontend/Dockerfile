# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the Next.js application
RUN npm run build

# ---

# Stage 2: Production environment
FROM node:20-alpine AS runner

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy the standalone output
COPY --from=builder /app/.next/standalone ./
# Copy the public and static folders
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]
