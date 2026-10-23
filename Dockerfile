# Imagem da plataforma para o EasyPanel (ou qualquer Docker): Node 24 e o
# cliente do Prisma para PostgreSQL. O endereço do banco vem do ambiente.
FROM node:24-bookworm-slim AS base
# O Prisma precisa do OpenSSL para falar com o banco.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
# Só diz ao Prisma que o banco é PostgreSQL; o build não conecta.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM base AS app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
# A cada implantação, aplica as migrações pendentes antes de subir.
CMD ["sh", "-c", "node scripts/prisma-db.mjs tabelas && npm start"]
