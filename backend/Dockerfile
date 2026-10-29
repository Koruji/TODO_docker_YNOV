# --- CONSTRUCTION --- #
# Déclaration d'un argument global pour la version JAVA (modifiable)
ARG JAVA_VERSION=25
# Récupération d'une image officielle maven sur DockerHub
# Java version 25 et maven 3.10
FROM maven:3.10-eclipse-temurin-${JAVA_VERSION} AS build
# Dossier de travail indiqué à Docker
WORKDIR /app

# Téléchargement des bibliothèques listées dans pom.xml en mode batch
COPY pom.xml .
RUN mvn -B dependency:go-offline

# Copie du code source
COPY src ./src
#  Construction du .jar sans exécution des tests en mode batch
RUN mvn -B -DskipTests package

# --- LANCEMENT APP --- #
# Image JAVA 25 finale en exécution seulement
FROM eclipse-temurin:${JAVA_VERSION}-jre
# Création d'un groupe d'utilisateur et création d'un user test
RUN groupadd --system userGroup && useradd --system --gid userGroup --no-create-home userTest
# Récupération du .jar dans le process build (name : artefactID-version.jar du pom.xml)
COPY --from=build /app/target/backend-0.0.1-SNAPSHOT.jar app.jar
# Choix de l'user créé pour lancer les commandes futures
USER userTest
EXPOSE 8080
# Commande a éxecuter au lancement (lancement du app.jar récupéré)
ENTRYPOINT ["java", "-jar", "app.jar"]