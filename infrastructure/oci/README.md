# ZTerminal Compute Node Deployment (OCI / VPS)

This directory contains the production automation for running ZTerminal's dedicated quantitative compute layer (FastAPI, Redis task queue, isolated Quant Worker, and Caddy reverse proxy) on a free or inexpensive VPS.

## Recommended Free Provider: Oracle Cloud Infrastructure (OCI) Always Free
- **Compute**: 4 Ampere A1 ARM OCPUs + 24 GB RAM (100% $0/month indefinitely).
- **Alternative**: Hetzner Cloud (CX22 / CPX21 ~€3.5-€7/mo) or standard Linux VPS.

## One-Click Deployment Instructions

1. Provision an **Ubuntu 22.04 or 24.04** VM on OCI or your preferred VPS provider.
2. Clone this repository onto the server:
   ```bash
   git clone https://github.com/zephyriaa/zterminal.git
   cd zterminal
   ```
3. Run the bootstrap script:
   ```bash
   chmod +x infrastructure/oci/bootstrap.sh
   ./infrastructure/oci/bootstrap.sh
   ```
4. Create your production environment file `infrastructure/.env`:
   ```bash
   cat << 'EOF' > infrastructure/.env
   API_DOMAIN=api.yourdomain.com
   LETSENCRYPT_EMAIL=your-email@domain.com
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true
   SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
   R2_S3_ENDPOINT=https://[ACCOUNT_ID].r2.cloudflarestorage.com
   R2_BUCKET_NAME=zterminal-data
   R2_ACCESS_KEY_ID=[R2_ACCESS_KEY]
   R2_SECRET_ACCESS_KEY=[R2_SECRET_KEY]
   EOF
   ```
5. Start the stack:
   ```bash
   docker compose -f infrastructure/docker-compose.production.yml --env-file infrastructure/.env up -d
   ```
6. Verify service health:
   ```bash
   curl https://api.yourdomain.com/health
   ```
