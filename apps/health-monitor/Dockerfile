FROM oven/bun:1.3

WORKDIR /app

COPY package.json ./
RUN bun install --production

COPY src ./src

CMD ["bun", "src/index.ts"]
