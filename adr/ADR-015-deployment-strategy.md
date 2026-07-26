# ADR-015: Deployment Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs deployment for:

- Development environment
- MVP production
- Future scaling

We need a strategy that:

- Is simple for MVP
- Scales later
- Keeps costs low initially
- Is reproducible

## Decision

### MVP: Docker Compose on Single VPS

- Deploy entire stack on one VPS
- Docker Compose for orchestration
- Simple,低成本, easy to manage

### Future: Cloud/Kubernetes

- Migrate to cloud when needed
- Kubernetes for scaling
- Managed services for databases

## Consequences

### Positive

- Simple to deploy and manage
- Low cost for MVP
- Full control over infrastructure
- Easy to debug

### Negative

- Single point of failure
- Manual scaling
- No high availability
- Backup responsibility

### Mitigations

- Automated backups
- Health checks and monitoring
- Easy migration path to cloud

## MVP Architecture

```
┌─────────────────────────────────────┐
│           Single VPS               │
│  ┌─────────────────────────────┐   │
│  │      Docker Compose        │   │
│  │  ┌─────────┐ ┌─────────┐  │   │
│  │  │ Backend │ │ Worker  │  │   │
│  │  └─────────┘ └─────────┘  │   │
│  │  ┌─────────┐ ┌─────────┐  │   │
│  │  │Dashboard│ │ pgadmin │  │   │
│  │  └─────────┘ └─────────┘  │   │
│  │  ┌─────────┐ ┌─────────┐  │   │
│  │  │Postgres │ │  Redis  │  │   │
│  │  └─────────┘ └─────────┘  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │        Nginx               │   │
│  │    (Reverse Proxy)         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## VPS Requirements

### MVP (1-100 users)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 80 GB SSD |
| Bandwidth | 1 TB | 2 TB |

### Estimated Cost

| Provider | Monthly Cost |
|----------|--------------|
| Hetzner | $5-10 |
| DigitalOcean | $12-24 |
| Vultr | $6-12 |
| AWS Lightsail | $10-20 |

## Docker Compose Production

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - backend
      - dashboard

  backend:
    build: ./apps/backend
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careeros
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  worker:
    build: ./apps/worker
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careeros
      - REDIS_URL=redis:6379
    depends_on:
      - postgres
      - redis

  dashboard:
    build: ./apps/dashboard
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=careeros
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Nginx Configuration

```nginx
upstream backend {
    server backend:3000;
}

upstream dashboard {
    server dashboard:3000;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        proxy_pass http://dashboard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Deployment Steps

### Initial Setup

```bash
# 1. SSH into VPS
ssh root@your-vps-ip

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Install Docker Compose
apt install docker-compose-plugin

# 4. Clone repository
git clone https://github.com/your-org/career-os.git
cd career-os

# 5. Configure environment
cp .env.example .env
nano .env

# 6. Start services
docker compose up -d

# 7. Run migrations
docker compose exec backend pnpm prisma migrate deploy

# 8. Check status
docker compose ps
```

### Updates

```bash
# 1. Pull latest
git pull

# 2. Rebuild images
docker compose build

# 3. Restart services
docker compose up -d

# 4. Run migrations if needed
docker compose exec backend pnpm prisma migrate deploy
```

## SSL/TLS

### Let's Encrypt (Free)

```bash
# Install certbot
apt install certbot

# Get certificate
certbot certonly --nginx -d yourdomain.com -d api.yourdomain.com

# Auto-renew
certbot renew --dry-run
```

## Backup Strategy

### Database

```bash
# Daily backup
docker compose exec postgres pg_dump -U user careeros > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20250115.sql | docker compose exec -T postgres psql -U user careeros
```

### Redis

```bash
# Backup
docker compose exec redis redis-cli BGSAVE

# Copy dump
docker cp $(docker compose ps -q redis):/data/dump.rdb ./redis_backup.rdb
```

## Monitoring

### Health Checks

```bash
# Backend
curl https://api.yourdomain.com/health

# Dashboard
curl https://yourdomain.com/health
```

### Logs

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f backend
```

## Future: Cloud Migration

### When to Migrate

- > 1000 concurrent users
- Need high availability
- Need auto-scaling
- Need managed services

### Migration Path

1. **Database**: Migrate to managed PostgreSQL (RDS, Cloud SQL)
2. **Cache**: Migrate to managed Redis (ElastiCache, Memorystore)
3. **Apps**: Containerize and deploy to Kubernetes
4. **Storage**: Move to object storage (S3, GCS)

## Configuration

```bash
# .env
NODE_ENV=production
DOMAIN=yourdomain.com
API_DOMAIN=api.yourdomain.com
SSL_ENABLED=true
```

## References

- [Docker Compose Production](https://docs.docker.com/compose/production/)
- [Nginx Reverse Proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Let's Encrypt](https://letsencrypt.org/)
