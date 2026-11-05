ARG NODE_IMAGE=node:22-bookworm
FROM ${NODE_IMAGE}
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build
EXPOSE 3000
# The same image runs the web app (default) and the background worker (see docker-compose.yml)
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
