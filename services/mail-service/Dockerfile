FROM oven/bun:1

WORKDIR /app

COPY package.json /app/

RUN bun install

COPY . .

ENTRYPOINT ["sh", "-c", "bun run start"]
