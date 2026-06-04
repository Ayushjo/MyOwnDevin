FROM node:20-alpine

RUN apk add --no-cache git curl bash

RUN git config --global user.email "agent@devin-local" && \
    git config --global user.name "Devin Agent"

WORKDIR /workspace

CMD ["tail", "-f", "/dev/null"]