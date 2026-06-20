FROM nginx:alpine
ARG SWAGGER_PASSWORD=swagger
RUN apk add --no-cache openssl apache2-utils && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/nginx.key \
      -out /etc/nginx/ssl/nginx.crt \
      -subj "/CN=localhost" && \
    htpasswd -bc /etc/nginx/.htpasswd admin "$SWAGGER_PASSWORD"
