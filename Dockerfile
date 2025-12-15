FROM oven/bun:1

WORKDIR /app

COPY package.json .

RUN bun install

COPY . .

EXPOSE 8001

ENTRYPOINT [ "bun", "dev" ]
