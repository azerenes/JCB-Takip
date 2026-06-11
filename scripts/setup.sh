#!/usr/bin/env bash
set -euo pipefail

# ==============================================================
# JCB Tracker - Tek Komut Kurulum
# Kullanım: curl -sSL https://raw.githubusercontent.com/azerenes/JCB-Takip/main/scripts/setup.sh | bash
# ==============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     JCB Tracker - Kurulum Sihirbazı  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# ---- Docker kontrol ----
if ! command -v docker &>/dev/null; then
    warn "Docker bulunamadi. Kuruluyor..."
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" = "ubuntu" ] || [ "$ID" = "debian" ]; then
            curl -fsSL https://get.docker.com | bash
            sudo usermod -aG docker "$USER"
            log "Docker kuruldu. Tekrar SSH baglantisi yapmaniz gerekebilir."
        else
            err "Bu script Ubuntu/Debian icindir. Lutfen Docker'i manuel kurun."
            exit 1
        fi
    else
        err "Isletim sistemi tespit edilemedi. Docker'i manuel kurun."
        exit 1
    fi
fi

if ! command -v docker compose &>/dev/null; then
    warn "Docker Compose bulunamadi. Kuruluyor..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

log "Docker hazir."

# ---- Domain bilgisi ----
echo ""
read -r -p "Domain adiniz (orn: takip.sirketiniz.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    err "Domain adi zorunludur."
    exit 1
fi

read -r -p "E-posta adresiniz (Let's Encrypt icin): " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
    ADMIN_EMAIL="admin@${DOMAIN}"
    warn "Varsayilan e-posta kullaniliyor: $ADMIN_EMAIL"
fi

# ---- Projeyi indir ----
INSTALL_DIR="/opt/jcb-tracker"
if [ -d "$INSTALL_DIR" ]; then
    warn "$INSTALL_DIR zaten var. Guncelleniyor..."
    cd "$INSTALL_DIR"
    git pull
else
    info "Proje indiriliyor: $INSTALL_DIR"
    sudo mkdir -p /opt
    sudo git clone https://github.com/azerenes/JCB-Takip.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# ---- .env olustur ----
JWT_SECRET=$(openssl rand -hex 32)

cat > .env <<EOF
# JCB Tracker - Otomatik Olusturuldu
DOMAIN=$DOMAIN
CADDY_EMAIL=$ADMIN_EMAIL
SERVER_URL=https://$DOMAIN
JWT_SECRET=$JWT_SECRET
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$(openssl rand -hex 4)
REQUIRE_SETUP=true
TZ=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "Europe/Istanbul")
EOF

log ".env dosyasi olusturuldu."
info "Admin sifresi .env dosyasinda ADMIN_PASSWORD olarak kayitlidir."

# ---- Docker compose ----
info "Servisler baslatiliyor..."
docker compose pull
docker compose up -d --build

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        KURULUM TAMAMLANDI!           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Adres:${NC}     https://$DOMAIN"
echo -e "  ${BLUE}Setup:${NC}     https://$DOMAIN/setup"
echo -e "  ${BLUE}Admin EP:${NC}  $(grep ADMIN_EMAIL .env | cut -d= -f2)"
echo -e "  ${BLUE}JSON:${NC}      $(cat .env | grep -v "^#" | grep -v "^$")"
echo ""
echo -e "  ${YELLOW}Setup sihirbazini acin ve lisans anahtarinizi girin.${NC}"
echo ""
