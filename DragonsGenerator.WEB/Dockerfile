# Étape 1 : Build de l'application Angular
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG APP_BUILD_COUNT=0
RUN printf "export const APP_VERSION = '1.%s';\n" "$APP_BUILD_COUNT" > src/environments/app-version.ts
RUN npm run build --configuration=production

# Étape 2 : Serveur Nginx pour servir l'application
FROM nginx:alpine

ARG NGINX_CONF=nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf

# Copie des fichiers compilés Angular avec le bon chemin
COPY --from=build /app/dist/DragonsGenerator.WEB/browser /usr/share/nginx/html

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
