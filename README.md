# Yoga Master Ankur

3-tier production monorepo:

| Folder | Tier | Stack |
|---|---|---|
| `frontend/` | Presentation | React (Vite) + Nginx in Docker |
| `backend/` | Application | Express API |
| `database/` | Data | PostgreSQL schema and image |

## Run locally

1. Start the database only:

```bash
cd G:\projects\yoga_website
npm run dev:database
```

If tables are missing:

```bash
cd backend
npm run db:init
npm run db:users
npm run db:schedule
npm run db:reviews
```

2. Start API and website together:

```bash
npm run install:all
npm run dev
```

- Website: http://localhost:5173  
- API: http://localhost:4000  

Admin: `admin@yoga.com` / `admin123`

## Environment

Copy `backend/.env.example` to `backend/.env`.  
Copy `database/.env.example` if you change Postgres user/password.

## Production (3 Docker services)

```bash
docker compose build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

- **frontend** — http://localhost (port 80), proxies `/api` to backend  
- **backend** — port 4000  
- **database** — port 5432  

Push three images to Docker Hub: `yoga-frontend`, `yoga-backend`, `yoga-database`.

## Production domain: www.yogawithmasterankur.com

Public site URL should be **https://www.yogawithmasterankur.com** (port 80/443), not `:4000`.

### 1. DNS (where the domain is registered)

Create **A** records pointing to your EC2 IP `44.247.55.81`:

| Host | Type | Value |
|---|---|---|
| `@` (yogawithmasterankur.com) | A | 44.247.55.81 |
| `www` | A | 44.247.55.81 |

Wait until `ping yogawithmasterankur.com` (or a DNS checker) shows that IP.

### 2. AWS security group (EC2 instance)

Inbound:

- **22** from your IP (SSH)
- **80** from `0.0.0.0/0` (HTTP)
- **443** from `0.0.0.0/0` (HTTPS)

Port **4000** is optional. Visitors should use the domain on 80/443.

### 3. Project files (already set for this domain)

| File | What to set |
|---|---|
| `.env.production.example` | Copy to `.env` **on the server** (passwords, `DATABASE_URL`, `JWT_SECRET`) |
| `CLIENT_ORIGIN` | `https://www.yogawithmasterankur.com,https://www.yogawithmasterankur.com` |
| `frontend/.env.example` / `VITE_API_URL` | Leave **empty** (Nginx on the frontend proxies `/api`) |
| `docker-compose.prod.yml` | Publishes frontend on host **80** |

Do not commit real passwords. Local `backend/.env` can stay on localhost for development.

### 4. On EC2 (Docker)

```bash
cd /path/to/yoga_website
cp .env.production.example .env
nano .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
curl http://127.0.0.1/api/public/home
```

Then open **http://www.yogawithmasterankur.com**.

### 5. HTTPS (Let's Encrypt)

```bash
sudo dnf install -y nginx certbot python3-certbot-nginx
```

Point Nginx to `http://127.0.0.1:4000` (or keep Docker on port 80 and put Certbot in front). Then:

```bash
sudo certbot --nginx -d yogawithmasterankur.com -d www.yogawithmasterankur.com
```

After SSL works, keep `CLIENT_ORIGIN` as the `https://` URLs above and recreate the web container.

## Deploy on Hostinger (production)

This project is **React + Express + PostgreSQL**. Typical Hostinger **shared hosting** (public_html + MySQL) cannot run this stack. Use a **Hostinger VPS** (or Cloud/VPS with Node.js), or host the React files on Hostinger and the API + Postgres elsewhere.

### Option A — Hostinger VPS (recommended)

One domain serves the website and the API.

1. Buy a VPS, install Node.js 20+, PostgreSQL 16, Nginx, and PM2.
2. Point your domain DNS A record to the VPS IP.
3. Upload the project (Git or File Manager / SFTP).
4. On the server:

```bash
cd /var/www/yoga_website
npm run install:all
cp backend/.env.example backend/.env
# edit backend/.env (see values below)
cd backend && npm run db:init && npm run db:users && npm run db:schedule && npm run db:reviews
cd ..
npm run build
NODE_ENV=production pm2 start backend/index.js --name yoga-api
```

5. Nginx should proxy the domain to `http://127.0.0.1:4000` and enable SSL (Let’s Encrypt).

**`backend/.env` on the VPS**

```
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/yoga_db
JWT_SECRET=a-long-random-secret
CLIENT_ORIGIN=https://yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=a-strong-password
```

Leave `client` `VITE_API_URL` empty so the browser calls `/api` on the same domain.

Change the default admin password before going live.

### Option B — Hostinger shared hosting (frontend only)

1. Build the React app on your PC: `cd frontend && npm install && npm run build`
2. If the API is on another URL, create `frontend/.env.production`:

```
VITE_API_URL=https://api.yourdomain.com
```

3. Upload the contents of `frontend/dist` to `public_html`.
4. Add an `.htaccess` in `public_html` so React Router works:

```
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

5. Run Express + PostgreSQL on a VPS, Railway, Render, or similar. Shared Hostinger databases are MySQL, not PostgreSQL.

### Production checklist

- New `JWT_SECRET` and admin password
- HTTPS on the domain
- `CLIENT_ORIGIN` set to your real website URL
- PostgreSQL backups
- `uploads/` folder writable on the server
- Do not commit `.env` files

## Deploy on AWS (step by step)

This is the straightforward production path for this repo: **Amazon RDS (PostgreSQL)** for the database and **Amazon EC2** for Node.js, the React build, and Nginx. One domain serves both the website and `/api`.

You need an AWS account, a domain, and a key pair for SSH.

### Step 1 — Create the database (RDS)

1. Open **RDS** → **Create database**.
2. Choose **PostgreSQL** 16, **Free tier** or `db.t3.micro` if you are starting small.
3. Set DB name `yoga_db`, a master username, and a strong password. Save these.
4. **Public access**: No (the EC2 instance will connect privately).
5. Create a new VPC security group, e.g. `yoga-db-sg`.
6. Create the database and wait until status is **Available**.
7. Copy the **endpoint**, e.g. `yoga-db.xxxxx.ap-south-1.rds.amazonaws.com`.

### Step 2 — Create the server (EC2)

1. Open **EC2** → **Launch instance**.
2. Name: `yoga-web`.
3. AMI: **Amazon Linux 2023**.
4. Type: `t3.small` (or `t3.micro` for testing).
5. Create or select a **key pair** (`.pem`). Download it and keep it safe.
6. Network: same VPC as RDS.
7. Security group `yoga-web-sg` inbound rules:
   - SSH `22` from your IP
   - HTTP `80` from `0.0.0.0/0`
   - HTTPS `443` from `0.0.0.0/0`
8. Storage: 20 GB gp3 is enough.
9. Launch the instance. Allocate an **Elastic IP** and associate it so the public IP does not change.

### Step 3 — Allow EC2 to reach RDS

1. Open the RDS security group `yoga-db-sg`.
2. Inbound: PostgreSQL port **5432** from security group `yoga-web-sg` (not from the whole internet).

### Step 4 — SSH in and install software

On Windows PowerShell (use your key and Elastic IP):

```bash
ssh -i yoga-key.pem ec2-user@YOUR_ELASTIC_IP
```

On the server:

```bash
sudo dnf update -y
sudo dnf install -y git nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

### Step 5 — Put the project on the server

```bash
sudo mkdir -p /var/www
sudo chown ec2-user:ec2-user /var/www
cd /var/www
git clone YOUR_REPO_URL yoga_website
cd yoga_website
npm run install:all
```

Or upload the folder with SCP/SFTP instead of Git.

### Step 6 — Production environment file

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Use:

```
NODE_ENV=production
PORT=4000
HOST=127.0.0.1
DATABASE_URL=postgresql://MASTER_USER:MASTER_PASSWORD@RDS_ENDPOINT:5432/yoga_db
JWT_SECRET=a-long-random-secret
CLIENT_ORIGIN=https://yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=a-strong-password
```

Do not use the local `yoga123` password. URL-encode special characters in the RDS password if needed.

Leave `client` `VITE_API_URL` empty so the browser calls `/api` on the same domain.

### Step 7 — Create tables and build the site

```bash
cd /var/www/yoga_website/server
npm run db:init
npm run db:users
npm run db:schedule
npm run db:reviews
cd /var/www/yoga_website
npm run build
mkdir -p backend/uploads
```

If `db:init` fails with “already exists”, the later `db:users` / `db:schedule` / `db:reviews` commands are still enough.

### Step 8 — Run the API with PM2

```bash
cd /var/www/yoga_website
NODE_ENV=production pm2 start backend/index.js --name yoga-api
pm2 save
pm2 startup
```

Follow the `sudo env PATH=...` command that `pm2 startup` prints.

Check: `curl http://127.0.0.1:4000/api/public/home` should return JSON.

### Step 9 — Nginx reverse proxy

```bash
sudo nano /etc/nginx/conf.d/yoga.conf
```

Put this (use your domain):

```
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### Step 10 — Point the domain at AWS

1. In your domain registrar (or Route 53), create an **A record**:
   - `yourdomain.com` → Elastic IP
   - `www` → same Elastic IP (A or CNAME)
2. Wait for DNS (often a few minutes, sometimes longer).
3. Open `http://yourdomain.com` and confirm the site loads.

### Step 11 — HTTPS (Let’s Encrypt)

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will edit Nginx and renew certificates automatically.

Then set `CLIENT_ORIGIN=https://yourdomain.com` in `backend/.env` and run `pm2 restart yoga-api`.

### Step 12 — After you change code

```bash
cd /var/www/yoga_website
git pull
npm run install:all
npm run build
pm2 restart yoga-api
```

### Optional AWS pieces

| Service | When to add it |
|---|---|
| **Route 53** | Manage DNS inside AWS |
| **S3** | Store teacher/class images instead of `backend/uploads` |
| **CloudWatch** | Logs and disk/CPU alarms |
| **RDS snapshots** | Daily backups (enable in RDS) |
| **Elastic Beanstalk** | AWS builds/runs Node for you; still attach RDS |

Elastic Beanstalk alternative: zip the repo, set the same `backend/.env` values as EB environment properties, Platform **Node.js**, and add an RDS PostgreSQL instance in the same environment. Nginx + PM2 on EC2 is usually clearer for this project.

### AWS production checklist

- RDS is not open to `0.0.0.0/0` on port 5432
- SSH is limited to your IP
- New `JWT_SECRET` and admin password
- HTTPS working
- `pm2 save` so the app starts after reboot
- RDS automated backups on
- `.env` not committed to Git

## Docker and Docker Hub (step by step)

The `Dockerfile` builds the React app and the Express API into one image. PostgreSQL stays a separate official image (`postgres:16`). You push **your app image** to Docker Hub, not Postgres.

Replace `yourdockerhubuser` with your Docker Hub username everywhere below.

### Step 1 — Install Docker Desktop

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
2. Create a free account at [https://hub.docker.com](https://hub.docker.com).
3. In Docker Hub, click **Create repository**.
4. Name: `yoga-website` (public or private). Create.

### Step 2 — Log in from your PC

```bash
docker login
```

Enter your Docker Hub username and password (or access token from **Account settings → Personal access tokens**).

### Step 3 — Build the image

The Dockerfile must be built from the **project root** (`yoga_website`), the folder that contains both `client` and `server`. Do not run `docker build` from inside `client` or `server`.

```bash
cd G:\projects\yoga_website
docker build -t yourdockerhubuser/yoga-website:latest .
```

On Windows you can also run `docker-build.bat` in that same folder.

If you see `COPY failed ... frontend/package.json: file does not exist`, you are in the wrong directory. Check with `dir client\package.json` (Windows) or `ls frontend/package.json` (Linux). That file must exist in the folder where you run `docker build`.

Optional version tag:

```bash
docker build -t yourdockerhubuser/yoga-website:1.0.0 .
```

### Step 4 — Test locally before upload

```bash
docker compose up --build
```

Open http://localhost:4000  
Admin: `admin@harmonyyoga.com` / `admin123`

Stop with `Ctrl+C`, then `docker compose down` (add `-v` only if you also want to wipe the database volume).

### Step 5 — Push to Docker Hub

```bash
docker push yourdockerhubuser/yoga-website:latest
```

If you also tagged `1.0.0`:

```bash
docker push yourdockerhubuser/yoga-website:1.0.0
```

On Docker Hub, open the `yoga-website` repository and confirm the tags are listed.

### Step 6 — Pull and run on another machine (VPS, AWS, Hostinger VPS)

```bash
docker login
docker pull yourdockerhubuser/yoga-website:latest
```

You still need PostgreSQL. Fastest way: copy `docker-compose.yml` to the server and set your username:

```bash
set DOCKERHUB_USER=yourdockerhubuser
docker compose pull
docker compose up -d
```

On Linux:

```bash
export DOCKERHUB_USER=yourdockerhubuser
docker compose pull
docker compose up -d
```

Or run the app container against an existing database (RDS, etc.):

```bash
docker run -d --name yoga_web -p 80:4000 ^
  -e NODE_ENV=production ^
  -e HOST=0.0.0.0 ^
  -e PORT=4000 ^
  -e DATABASE_URL=postgresql://USER:PASSWORD@DB_HOST:5432/yoga_db ^
  -e JWT_SECRET=a-long-random-secret ^
  -e CLIENT_ORIGIN=https://yourdomain.com ^
  -e ADMIN_EMAIL=admin@yourdomain.com ^
  -e ADMIN_PASSWORD=a-strong-password ^
  yourdockerhubuser/yoga-website:latest
```

On Linux/macOS use `\` instead of `^` for line breaks.

### Step 7 — After you change code

```bash
docker build -t yourdockerhubuser/yoga-website:latest .
docker push yourdockerhubuser/yoga-website:latest
```

On the server: `docker compose pull && docker compose up -d`

### Docker notes

- Do not put `.env` secrets inside the image. Pass them with `-e` or Compose `environment`.
- Uploaded teacher/class images live in the `yoga_uploads` volume (or a bind mount) so they survive container rebuilds.
- Never push an image that contains real production passwords.


