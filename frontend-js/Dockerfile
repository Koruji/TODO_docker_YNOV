# --- CONSTRUCTION --- #
# Récupération d'une image officielle Node sur DockerHub
FROM node:22 AS build
WORKDIR /app

# Téléchargement des dépendances
COPY package.json package-lock.json ./
RUN npm ci

# Copie du code source
COPY . .
# Vérification et construction du site 
RUN npm run build

# --- LANCEMENT APP --- #
# Nouvelle image pour le serveur et lancement du front
FROM nginx:alpine
# Récupération du site dans le process build
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80