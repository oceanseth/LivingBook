FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# Bake the embedding model into the image (no runtime HF download)
RUN node warmup.mjs
ENV PORT=8787 STORE=pg VECTOR_STORE=pg
EXPOSE 8787
CMD ["node", "server.mjs"]
