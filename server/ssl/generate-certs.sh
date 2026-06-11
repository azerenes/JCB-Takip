#!/bin/bash
# JCB Tracker - SSL Sertifika Oluşturma
# Kullanım: bash generate-certs.sh

CERT_DIR="$(dirname "$0")"
DAYS=3650
KEY="$CERT_DIR/server.key"
CERT="$CERT_DIR/server.crt"

echo "🔐 JCB Tracker SSL Sertifikalari Olusturuluyor..."

openssl req -x509 -nodes -days $DAYS -newkey rsa:2048 \
    -keyout "$KEY" \
    -out "$CERT" \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=JCB Tracker/OU=IoT/CN=jcbtracker.local" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0"

echo "✅ Sertifikalar olusturuldu:"
echo "   Key : $KEY"
echo "   Cert: $CERT"

# EMQX için PEM formatı
cp "$CERT" "$CERT_DIR/emqx.crt"
cp "$KEY"  "$CERT_DIR/emqx.key"
echo "✅ EMQX sertifikalari kopyalandi"
