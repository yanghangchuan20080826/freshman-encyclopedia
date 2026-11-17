FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/var/data/community.sqlite
ENV TRUST_PROXY=true

COPY package.json ./
COPY server.js data.js index.html app.js styles.css ./
COPY assets ./assets

RUN mkdir -p /var/data && chown -R node:node /app /var/data

USER node

EXPOSE 3000

CMD ["node", "server.js"]
