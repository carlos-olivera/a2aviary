FROM alpine:3.23.4 AS download
ARG TARGETARCH
RUN apk add --no-cache curl unzip ca-certificates
RUN case "$TARGETARCH" in amd64) checksum='9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa' ;; arm64) checksum='86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418' ;; *) exit 1 ;; esac && curl --fail --location --silent --show-error "https://github.com/pocketbase/pocketbase/releases/download/v0.40.4/pocketbase_0.40.4_linux_$TARGETARCH.zip" -o /tmp/pb.zip && echo "$checksum  /tmp/pb.zip" | sha256sum -c - && unzip /tmp/pb.zip -d /pb
FROM alpine:3.23.4
RUN apk add --no-cache ca-certificates && adduser -D -u 1000 pocketbase
COPY --from=download /pb /pb
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
COPY pb_public /pb/pb_public
RUN mkdir -p /pb/pb_data && chown -R pocketbase:pocketbase /pb
USER pocketbase
EXPOSE 8090
WORKDIR /pb
CMD ["/pb/pocketbase","serve","--http=[::]:8090","--dir=/pb/pb_data","--encryptionEnv=PB_ENCRYPTION_KEY"]
