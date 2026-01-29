FROM rust:alpine3.23 AS builder
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    openssl-libs-static \
    pkgconf
WORKDIR /app
COPY . .
ENV OPENSSL_STATIC=1
RUN cargo build --release

FROM alpine:3.23 AS user
RUN adduser -D -u 1000 mailuser
FROM scratch
COPY --from=user /etc/passwd /etc/passwd
COPY --from=builder --chown=1000:1000 /app/target/release/mail-service /mail-service
USER 1000:1000
COPY --from=builder --chown=1000:1000 /app/target/release/mail-service /mail-service
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/mail-service"]
