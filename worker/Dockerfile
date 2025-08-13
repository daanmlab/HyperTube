FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

COPY . .

CMD ["npm", "run", "start:dev"]
