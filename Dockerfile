FROM oven/bun:1

WORKDIR /app

COPY package.json /app/

RUN bun install

COPY . .

EXPOSE 8001

#ENTRYPOINT ["sh", "-c", "(bun run db:generate || true) && (bun run db:migrate || true) && (bun run db:seed || true) && bun run dev"]

ENTRYPOINT ["sh", "-c", "(bun run db:generate || true) && (bun run db:migrate || true) && bun run dev"]
