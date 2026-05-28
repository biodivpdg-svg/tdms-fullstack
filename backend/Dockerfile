FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Run DB init then start server
CMD ["sh", "-c", "node db/init.js && node server.js"]

EXPOSE 3001
