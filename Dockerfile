# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
COPY src .
# Build static assets into dist
RUN npm run build 

# Production stage
FROM nginx:alpine AS prod
WORKDIR /usr/share/nginx/html
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist
COPY --from=build /app/nginx.conf /etc/nginx/nginx.conf

# Copy server code for ws relay only
WORKDIR /app
COPY --from=build /app/server.js ./
COPY --from=build /app/package.json ./
RUN apk add --no-cache nodejs npm
RUN npm install --production

EXPOSE 3001 80

CMD ["sh", "-c", "node /app/server.js & nginx -g 'daemon off;'"]
