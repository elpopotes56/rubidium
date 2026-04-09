FROM node:22-alpine

# Set working directory to backend
WORKDIR /app/backend

# Copy only backend dependency files first (for layer caching)
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install ALL dependencies (including devDeps needed for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy backend source code
COPY backend/ .

# Build TypeScript
RUN npm run build

# Expose the port
# Let Railway assign the PORT dynamically via its own rules

# Start the server and ensure DB is migrated
CMD ["node", "dist/index.js"]
