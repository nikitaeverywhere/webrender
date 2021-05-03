FROM node:14-alpine

ENV PORT_WEBRENDER=8080

COPY . /code
WORKDIR /code

RUN npm install
RUN npm run build
RUN npm prune --production

RUN rm -rf src package-lock.json tsconfig.json Dockerfile .vscode .gitignore

EXPOSE $PORT_WEBRENDER

ENTRYPOINT ["node", "build/index.js"]