FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY backend/ ./backend/
COPY openapi.yaml ./openapi.yaml
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon build -x test

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/backend/build/quarkus-app/ /app/
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/quarkus-run.jar"]
