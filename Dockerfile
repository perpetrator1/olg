FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

EXPOSE 5173

# Start development server and bind to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
