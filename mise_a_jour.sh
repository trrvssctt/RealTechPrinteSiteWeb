#!/bin/bash
# Script de mise à jour — RealTech Print
# Usage : bash mise_a_jour.sh [branche]  (défaut : V1.2_06_janv_2026)

set -e

PROJET="/opt/realtech/RealTechPrinteSiteWeb"
BRANCHE="${1:-V1.2_06_janv_2026}"
PM2_NAME="realtech-backend"

echo "========================================"
echo "  MISE À JOUR REALTECH PRINT"
echo "  Branche : $BRANCHE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# ── 1. Pull les derniers changements ─────────────────────────────
echo ""
echo "[1/5] Pull GitHub..."
cd "$PROJET"
git fetch origin
# Force la mise à jour sans bloquer sur les fichiers locaux modifiés
git reset --hard "origin/$BRANCHE"
# Supprimer les fichiers non-trackés sauf node_modules et dist
git clean -fd --exclude=node_modules --exclude=backend/node_modules --exclude=dist
echo "      OK — code à jour"

# ── 2. Mettre à jour le .env backend ─────────────────────────────
echo ""
echo "[2/5] Mise à jour .env backend..."
python3 - << 'PYEOF'
env_content = """DATABASE_HOST=postgresql-gestionapp.alwaysdata.net
DATABASE_PORT=5432
DATABASE_NAME=gestionapp_site_web_realtech
DATABASE_USER=gestionapp
DATABASE_PASSWORD=Dianka16
DATABASE_URL=postgresql://gestionapp:Dianka16@postgresql-gestionapp.alwaysdata.net:5432/gestionapp_site_web_realtech

PORT=4000
FRONTEND_ORIGIN=https://realtechprint.com
ADMIN_SETUP_TOKEN=sggsttarzrrzfs12AZQUZ1251A32DA251
NODE_ENV=production
CONTACT_NOTIFY_EMAIL=sidydiop.boss@realtechprint.com

SMTP_HOST=mail.realtechprint.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sidydiop.boss@realtechprint.com
SMTP_PASS=AmySidyboss@1
SMTP_FROM=RealTech Print <sidydiop.boss@realtechprint.com>
DAILY_REPORT_EMAIL=diankaseydou52@gmail.com

N8N_BASE_URL=https://n8n.realtechprint.com
N8N_EVENTS_PATH=/webhook/rt-events-001
N8N_AGENT_PATH=/webhook-test/rt-agent-001
N8N_REPORT_PATH=/workflow/WBzmPIcvQCOvWU2S/d4bc10?projectId=wUg55olFqefRijk3
N8N_WEBHOOK_KEY=

EVOLUTION_API_URL=https://evolution.realtechprint.com
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=realtech
ADMIN_WHATSAPP_NUMBER=221771234567
"""
with open('/opt/realtech/RealTechPrinteSiteWeb/backend/.env', 'w') as f:
    f.write(env_content)
print("      OK — .env backend écrit")
PYEOF

# ── 3. Backend — dépendances + redémarrage PM2 ───────────────────
echo ""
echo "[3/5] Redémarrage backend..."
cd "$PROJET/backend"
npm install --omit=dev --silent

if pm2 list | grep -q "$PM2_NAME"; then
    pm2 restart "$PM2_NAME"
    echo "      OK — PM2 redémarré"
else
    pm2 start src/app.js --name "$PM2_NAME"
    pm2 save
    echo "      OK — PM2 démarré"
fi

# ── 4. Frontend — rebuild ─────────────────────────────────────────
echo ""
echo "[4/5] Rebuild frontend..."
cd "$PROJET"
echo "VITE_API_BASE_URL=https://realtechprint.com" > .env.production
npm install --silent
npm run build
echo "      OK — dist/ généré"

# ── 5. Nginx — vérifier et recharger ─────────────────────────────
echo ""
echo "[5/5] Rechargement nginx..."
nginx -t 2>/dev/null && systemctl reload nginx
echo "      OK — nginx rechargé"

# ── Résumé final ──────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  DÉPLOIEMENT TERMINÉ"
echo "========================================"
echo ""
echo "Statut backend :"
pm2 list | grep "$PM2_NAME" || echo "  ATTENTION : process PM2 introuvable"
echo ""
echo "Test API :"
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://realtechprint.com/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ping@test.com","password":"ping"}')
if [ "$RESULT" = "200" ] || [ "$RESULT" = "401" ] || [ "$RESULT" = "400" ]; then
    echo "  OK — API répond (HTTP $RESULT)"
else
    echo "  ERREUR — API répond HTTP $RESULT (attendu 200/401/400)"
fi
echo ""
echo "  Site : https://realtechprint.com"
echo "========================================"
