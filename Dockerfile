FROM node:6

RUN apt-get update
RUN apt-get install -y redis-server

RUN curl https://install.meteor.com | /bin/sh

ADD shuriken /shuriken
ADD shuriken-web /shuriken-web

RUN cd /shuriken && make
RUN cd /shuriken-web && make

RUN bash
