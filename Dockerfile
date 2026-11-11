# CollabBoard as ONE image: the Spring Boot server with the built frontend
# inside it. One service, one URL, no cross-origin configuration.
#
#   docker build -t collabboard .
#   docker run -p 8080:8080 -e DATABASE_URL=postgresql://user:pass@host/db collabboard
#
# This is what render.yaml deploys. The per-folder Dockerfiles remain for
# running the frontend and backend as separate services (docker-compose.yml).

# ---- 1. build the frontend ----
FROM node:22-alpine AS frontend
WORKDIR /app
COPY collabboard-frontend/package.json collabboard-frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY collabboard-frontend/ ./
# No VITE_* variables: the app then talks to the origin it was served from.
RUN npm run build

# ---- 2. build the backend, with the frontend as its static files ----
FROM eclipse-temurin:17-jdk-alpine AS backend
RUN apk add --no-cache maven
WORKDIR /app
COPY collabboard-backend/pom.xml .
RUN mvn -B -q dependency:go-offline || true
COPY collabboard-backend/src ./src
COPY --from=frontend /app/dist ./src/main/resources/static
RUN mvn -B clean package -DskipTests

# ---- 3. run ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Don't run as root.
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=backend /app/target/*.jar app.jar

EXPOSE 8080

# Size the heap from the container's limit rather than the host's, which
# matters on small free-tier instances.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/health" > /dev/null || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
