# Use official Node.js LTS as the base image
FROM node:20-alpine as build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy all source files
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
