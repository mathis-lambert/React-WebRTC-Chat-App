FROM node:latest
LABEL authors="mathis.lambert"

WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app

EXPOSE 3001

CMD ["npm", "start"]