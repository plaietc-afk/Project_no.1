# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and tsconfig
COPY package*.json tsconfig.json ./

# Install all dependencies including dev dependencies needed for build
RUN apk add --no-cache python3 make g++ && npm ci

# Copy the source code
COPY ./src ./src

# Build the TypeScript code
RUN npx tsc

# Remove development dependencies
RUN npm prune --production

# ---

# Stage 2: Production environment
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy built application, node_modules and package.json from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD [ "node", "dist/index.js" ]
