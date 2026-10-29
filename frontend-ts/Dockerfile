# --- CONSTRUCTION --- #
# Déclaration d'un argument global pour la version Node (modifiable)
ARG NODE_VERSION=22
# Récupération d'une image officielle Node sur DockerHub
FROM node:${NODE_VERSION} AS build
WORKDIR /app

# Téléchargement des dépendances
COPY package.json package-lock.json ./
RUN npm ci

# Copie du code source
COPY . .
# Vérification et construction du site 
RUN npm run build

# --- LANCEMENT APP --- #
# Nouvelle image pour le serveur et lancement du front(version non privilégié)
FROM nginxinc/nginx-unprivileged:alpine
# Récupération du site dans le process build
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080