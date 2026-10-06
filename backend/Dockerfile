# The .mpp / Primavera / GanttProject converter as a small web service.
# Build from the repository root:
#   docker build -f backend/Dockerfile -t planner-converter .
# Render, Railway, Fly.io and similar hosts can run this image directly
# (see render.yaml). Point the website at it with VITE_MSPROJECT_BACKEND_URL.

# 1. Compile the Java converter (MPXJ) and collect its libraries.
FROM maven:3.9-eclipse-temurin-17 AS java
WORKDIR /build
COPY backend/java-mpxj/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY backend/java-mpxj/src ./src
RUN mvn -q -B compile dependency:copy-dependencies -DincludeScope=runtime

# 2. Node web server + Java runtime.
FROM node:22-bookworm-slim
COPY --from=eclipse-temurin:17-jre /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk \
    PATH="/opt/java/openjdk/bin:${PATH}"
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/server.js backend/converter.js ./
COPY --from=java /build/target/classes ./java-mpxj/target/classes
COPY --from=java /build/target/dependency ./java-mpxj/target/dependency
RUN mkdir -p uploads && chown node:node uploads

ENV NODE_ENV=production \
    PORT=10000 \
    SKIP_CONVERTER_BUILD=true
EXPOSE 10000
USER node
CMD ["node", "server.js"]
