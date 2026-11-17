FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PASABUY_DATA_DIR=/data
COPY --from=build --chown=node:node /app ./
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["npm", "start"]
