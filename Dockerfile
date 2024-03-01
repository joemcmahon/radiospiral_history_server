FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./
RUN yarn install

COPY . .

ENV SECURE_PORT 5443
ENV INSECURE_PORT 5000
EXPOSE $INSECURE_PORT
EXPOSE $SECURE_PORT


# Command to run the application
CMD ["yarn", "start"]

