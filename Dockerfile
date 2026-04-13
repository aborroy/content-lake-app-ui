# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY angular.json tsconfig.json ./
COPY src ./src
RUN npm ci && npm install -g @angular/cli@~18.2.0
RUN ng build

# Runtime stage
FROM nginx:alpine
COPY --from=build /app/dist/content-lake-app-ui/browser /usr/share/nginx/html
COPY nginx-app.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
# Defaults assume the container is reachable at localhost:4200.
# The container's own nginx proxies /api/rag, /alfresco/, /nuxeo/
# to the backend services on the Docker network — no cross-origin issues.
ENV ALFRESCO_URL=http://localhost:4200
ENV NUXEO_URL=http://localhost:4200/nuxeo
ENV RAG_URL=http://localhost:4200/api/rag
ENTRYPOINT ["/entrypoint.sh"]
