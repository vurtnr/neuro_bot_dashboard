FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_ROBOT_BASE_URL
ARG NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL
ARG NEXT_PUBLIC_PLANT_CREATED_WS_URL
ARG NEXT_PUBLIC_TIANDITU_KEY

ENV NEXT_PUBLIC_ROBOT_BASE_URL=$NEXT_PUBLIC_ROBOT_BASE_URL
ENV NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL=$NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL
ENV NEXT_PUBLIC_PLANT_CREATED_WS_URL=$NEXT_PUBLIC_PLANT_CREATED_WS_URL
ENV NEXT_PUBLIC_TIANDITU_KEY=$NEXT_PUBLIC_TIANDITU_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 80

CMD ["node", "server.js"]
