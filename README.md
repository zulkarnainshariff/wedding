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

## Deployment (DigitalOcean + GitHub Actions)

### Server preparation (one-time)

On your Ubuntu droplet:

```bash
# Node.js 20+ recommended
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo npm install -g pm2

# App directory
sudo mkdir -p /var/www/wedding
sudo chown $USER:$USER /var/www/wedding

# Clone after pushing to GitHub
cd /var/www/wedding
git clone git@github.com:YOUR_USER/wedding.git .
cp .env.example .env.local
# Edit .env.local with your DO Postgres DATABASE_URL

npm ci
npm run db:push
npm run db:seed   # optional sample data
npm run build
pm2 start npm --name wedding -- start -- -p 3001
pm2 save
pm2 startup
```

### OpenResty reverse proxy

Add to your OpenResty config for `wedding.zulkarnainshariff.com`:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
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

### GitHub Actions secrets

In your GitHub repo → Settings → Secrets, add:

| Secret | Description |
|--------|-------------|
| `DO_HOST` | Droplet IP or hostname |
| `DO_USER` | SSH user (e.g. `root` or deploy user) |
| `DO_SSH_KEY` | Private SSH key for deployment |
| `DATABASE_URL` | Postgres connection string (for build + migrations) |

Push to `main` triggers automatic deploy via `.github/workflows/deploy.yml`.

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
