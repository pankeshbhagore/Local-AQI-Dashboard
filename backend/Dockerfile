FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Create logs directory with correct permissions
RUN mkdir -p logs && chmod 777 logs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
