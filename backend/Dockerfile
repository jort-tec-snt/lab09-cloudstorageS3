# Backend de la galería S3. Las credenciales NO van en la imagen: entran por variables de entorno.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
