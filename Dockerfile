FROM node:10.16.3-alpine as server
# Set app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# FIX error Segmentation Fault : error 139
RUN apk add --no-cache --virtual .gyp \
  build-base \
  autoconf \
  automake \
  g++ \
  libpng-dev \
  libtool \
  make \
  nasm \
  python \
  git \
  && npm i \
  #  && npm rebuild bcrypt --build-from-source \
  && apk del .gyp

# RUN npm install
# RUN npm rebuild bcrypt --build-from-source
# Install everything (and clean up afterwards)

# If you are building your code for production
RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 5000
ENV NODE_ENV=production

CMD ["npm", "start"]