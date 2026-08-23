# ---- build ----
FROM eclipse-temurin:17-jdk-alpine AS build
RUN apk add --no-cache maven
WORKDIR /app

# Resolve dependencies in their own layer, keyed only on the pom. Ordinary
# source edits then rebuild without re-downloading the dependency tree.
# Best-effort: anything it misses is fetched by the package step below.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline || true

COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- run ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Don't run as root.
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

# Size the heap from the container's limit rather than the host's, which
# matters on small free-tier instances.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
