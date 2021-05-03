FROM zenika/alpine-chrome:with-node
# WORKDIR is specified in the parent container (/usr/src/app).

ENV PORT_WEBRENDER=8080
# https://playwright.dev/docs/installation/#skip-browser-downloads
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY build/ ./build
COPY package.json package-lock.json ./

RUN npm install --only=prod
RUN npm prune --production

# Cleanup unused stuff.
USER root
RUN apk del tini make gcc g++ python3 git nodejs-npm yarn
RUN rm -rf package-lock.json /var/cache/*
USER chrome

EXPOSE $PORT_WEBRENDER

ENTRYPOINT ["node", "./build/index.js"]