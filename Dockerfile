# syntax=docker/dockerfile:1
# Build context is the repo root: the build needs both app/ and config/.

FROM node:22-alpine AS build
WORKDIR /src

# BASE_PATH defaults to "/" here (the app's own default is /austin-health-pulse/ for GitHub Pages).
ARG BASE_PATH=/
ARG CITY_CONFIG=city.config.json
ARG VITE_SERVICE_GUIDE_URL=
ARG VITE_ENABLE_PERSONAL_CALCULATOR=false
ENV BASE_PATH=$BASE_PATH \
    CITY_CONFIG=$CITY_CONFIG \
    VITE_SERVICE_GUIDE_URL=$VITE_SERVICE_GUIDE_URL \
    VITE_ENABLE_PERSONAL_CALCULATOR=$VITE_ENABLE_PERSONAL_CALCULATOR

# Install deps first so this layer is cached until package files change.
COPY app/package.json app/package-lock.json app/
RUN cd app && npm ci

COPY app/ app/
COPY config/ config/
WORKDIR /src/app
RUN npm run validate:data && npm run build

# Runtime: non-root nginx on 8080. The alpine variant ships busybox wget for HEALTHCHECK.
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
# The base image already sets USER 101 (nginx); restated so it is explicit.
USER 101
