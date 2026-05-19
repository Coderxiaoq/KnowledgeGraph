FROM node:20-alpine

WORKDIR /app

# copy package files first to take advantage of Docker layer caching
COPY package*.json ./
# use npm ci for reproducible installs (requires package-lock.json)
RUN npm install

COPY . .
EXPOSE 5173

CMD ["npm", "run", "dev"]
