FROM node

WORKDIR /usr/src/app
COPY . .
RUN yarn install

CMD ["node", "/usr/src/app/index.js"]

