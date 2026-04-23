# Étape 1 : Build de l'application Angular
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build --configuration=production

# Étape 2 : Serveur Nginx pour servir l'application
FROM nginx:alpine

# Copie de notre configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers compilés Angular avec le bon chemin
COPY --from=build /app/dist/DragonsGenerator.WEB/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
