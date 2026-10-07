FROM node:20-alpine

ARG VCS_REF
LABEL org.opencontainers.image.revision=$VCS_REF

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY public ./public
COPY db ./db

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" || exit 1

USER node

CMD ["npm", "start"]
