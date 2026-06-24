# Wedding Itinerary

A private family wedding travel itinerary app built with **Next.js**, **PostgreSQL**, and **Drizzle ORM**. Browse flights, accommodation, car rentals, and travel insurance day-by-day or by category.

**Production URL:** `https://wedding.zulkarnainshariff.com`

## Features

- Day-by-day timeline (View All)
- Category views: Flights, Accommodation, Car Rental, Travel Insurance
- Item detail pages with Google Maps links and external booking URLs
- Responsive layout: sidebar (desktop), icon rail (tablet), bottom tabs + drawer (mobile)
- `/admin` page to add, edit, and delete days and items (no login — family use only)

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure database

Copy the example env file and set your Postgres URL:

```bash
cp .env.example .env.local
```

Create a database (if needed):

```sql
CREATE DATABASE wedding_itinerary;
```

### 3. Push schema and seed sample data

```bash
npm run db:push
npm run db:seed
```

Sample seed includes **3 flights**, **2 accommodation**, and **2 car rentals** across 5 days. Re-run `npm run db:seed` to reset sample data (it wipes existing rows).

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to Postgres |
| `npm run db:seed` | Reset and seed sample data |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:migrate` | Run migrations |

## Deployment (Docker + OpenResty)

The app runs in Docker and listens on **port 3002** on the host. OpenResty/nginx should proxy to `http://127.0.0.1:3002`.

**Repository:** [github.com/zulkarnainshariff/wedding](https://github.com/zulkarnainshariff/wedding)  
**Deploy branch:** `main` (GitHub Actions deploys on push to `main`)

### Server preparation (one-time)

On your Ubuntu droplet:

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in so the docker group applies

sudo mkdir -p /var/www/wedding
sudo chown $USER:$USER /var/www/wedding

cd /var/www/wedding
git clone git@github.com:zulkarnainshariff/wedding.git .
git checkout main
cp .env.example .env
# Edit .env: DATABASE_URL, SESSION_SECRET

chmod +x scripts/docker-deploy.sh
./scripts/docker-deploy.sh

# Optional first-time data (uses the migrate image which includes dev tooling)
docker compose --profile tools run --rm migrate npm run db:seed-users
```

If the server directory already exists with another remote, point it at your repo:

```bash
cd /var/www/wedding
git remote set-url origin git@github.com:zulkarnainshariff/wedding.git
git fetch origin main
git checkout main
git reset --hard origin/main
```

The deploy script builds the image, runs `db:push`, and starts the container bound to `127.0.0.1:3002`.

### OpenResty reverse proxy

Point your site at the Docker host port:

```nginx
location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### Manual Docker commands

```bash
docker compose build
docker compose --profile tools run --rm migrate   # push schema
docker compose up -d                            # start / restart
docker compose logs -f wedding                  # follow logs
docker compose down                             # stop
```

### Environment variables

Create `.env` on the server (not committed):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Long random string for auth cookies |
| `PORT` | Host port in `.env.example` (3002); container uses 3000 internally |

`DATABASE_URL` is also passed at **image build time** for Next.js static generation.

### GitHub Actions secrets

In **your** repo ([zulkarnainshariff/wedding](https://github.com/zulkarnainshariff/wedding)) → Settings → Secrets and variables → Actions, add:

| Secret | Description |
|--------|-------------|
| `DO_HOST` | Droplet IP or hostname |
| `DO_USER` | SSH user (e.g. `root` or deploy user) |
| `DO_SSH_KEY` | Private SSH key for deployment |

The server must already have `.env` configured. Push to `main` on **zulkarnainshariff/wedding** runs `scripts/docker-deploy.sh` over SSH. You can also trigger a deploy manually from the Actions tab (`workflow_dispatch`).

## Replacing sample data

1. Open `/admin` on your running app
2. Edit or delete sample items
3. Add your real flights, stays, and car rentals

Or pass your data and re-seed with a custom script later.

## Project structure

```
src/
  app/              # Next.js routes + API
  components/       # UI components
  lib/              # DB, schema, queries, types
  db/seed.ts        # Sample data seeder
```
