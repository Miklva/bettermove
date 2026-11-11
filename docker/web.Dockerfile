# Construit le site avec Vite puis le sert avec nginx
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Informations legales injectees dans le site au moment de la construction
ARG VITE_SITE_URL=
ARG VITE_LEGAL_EDITOR=
ARG VITE_LEGAL_HOST_NAME=
ARG VITE_LEGAL_HOST_ADDRESS=
ARG VITE_LEGAL_HOST_PHONE=
ARG VITE_SOURCE_URL=
# Verification Google Search Console (balise meta), facultative
ARG VITE_GOOGLE_SITE_VERIFICATION=
ENV VITE_SITE_URL=$VITE_SITE_URL VITE_LEGAL_EDITOR=$VITE_LEGAL_EDITOR VITE_LEGAL_HOST_NAME=$VITE_LEGAL_HOST_NAME VITE_LEGAL_HOST_ADDRESS=$VITE_LEGAL_HOST_ADDRESS VITE_LEGAL_HOST_PHONE=$VITE_LEGAL_HOST_PHONE VITE_SOURCE_URL=$VITE_SOURCE_URL VITE_GOOGLE_SITE_VERIFICATION=$VITE_GOOGLE_SITE_VERIFICATION
RUN npm run build

FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
