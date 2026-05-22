# VPS Setup Guide

This guide explains how to deploy VeritaScan on an Ubuntu VPS, connect a Hostinger domain, run the Node.js backend with PM2, serve the React frontend with Nginx, and enable HTTPS.

Replace these placeholders before running commands:

```text
your-domain.com
www.your-domain.com
YOUR_VPS_IP
your-gemini-api-key
replace-with-a-long-random-secret
```

## 1. Point Hostinger Domain to the VPS

In Hostinger:

1. Open `Domains`.
2. Select your domain.
3. Open `DNS / Nameservers` or `DNS Zone`.
4. Add or update these DNS records:

```text
Type    Name    Value        TTL
A       @       YOUR_VPS_IP  300
A       www     YOUR_VPS_IP  300
```

If Hostinger is not managing your DNS, change the nameservers to Hostinger first, or add the same `A` records wherever your DNS is hosted.

DNS changes can take a few minutes to several hours. You can check propagation with:

```bash
dig your-domain.com
dig www.your-domain.com
```

## 2. Connect to the VPS

```bash
ssh root@YOUR_VPS_IP
```

Update the server:

```bash
apt update
apt upgrade -y
```

Install required packages:

```bash
apt install -y nginx git curl ufw
```

## 3. Configure Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## 4. Install Node.js

Install Node.js 20 using NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

## 5. Install MongoDB

For a simple VPS setup, install MongoDB locally:

```bash
apt install -y gnupg
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl enable mongod
systemctl start mongod
systemctl status mongod
```

If your VPS is not Ubuntu 22.04 Jammy, use the MongoDB install page for your Ubuntu version, or use MongoDB Atlas and set `MONGODB_URI` to the Atlas connection string.

## 6. Clone the Repository

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/ankitsharma785197/veritascan.git
cd veritascan
```

Install dependencies:

```bash
npm install
```

## 7. Create Environment File

Create the production `.env` file in the project root:

```bash
nano .env
```

Use this template:

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/veritascan
JWT_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_FALLBACKS=gemini-2.5-flash-lite,gemini-2.0-flash
CLIENT_ORIGIN=https://your-domain.com
```

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

## 8. Build the Frontend

Because the frontend and API will run on the same domain, build the frontend with `/api` as the API base:

```bash
VITE_API_BASE=/api npm run build
```

The built files will be created in:

```text
frontend/dist
```

## 9. Run Backend with PM2

Install PM2:

```bash
npm install -g pm2
```

Start the backend:

```bash
pm2 start backend/src/server.js --name veritascan-api
pm2 save
pm2 startup
```

After running `pm2 startup`, copy and run the command PM2 prints.

Check logs:

```bash
pm2 logs veritascan-api
```

## 10. Configure Nginx

Create an Nginx site config:

```bash
nano /etc/nginx/sites-available/veritascan
```

Paste this config:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/veritascan/frontend/dist;
    index index.html;

    client_max_body_size 25M;

    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/veritascan /etc/nginx/sites-enabled/veritascan
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Visit:

```text
http://your-domain.com
```

## 11. Enable HTTPS

Install Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Issue the SSL certificate:

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Test renewal:

```bash
certbot renew --dry-run
```

After HTTPS is active, update `.env` if needed:

```env
CLIENT_ORIGIN=https://your-domain.com
```

Restart the backend:

```bash
pm2 restart veritascan-api
```

## 12. Deployment Updates

When you push new code to GitHub, update the VPS with:

```bash
cd /var/www/veritascan
git pull origin main
npm install
VITE_API_BASE=/api npm run build
pm2 restart veritascan-api
systemctl reload nginx
```

## 13. Health Check

Check the backend health endpoint:

```bash
curl https://your-domain.com/api/health
```

Expected response:

```json
{
  "ok": true,
  "geminiConfigured": true
}
```

## Troubleshooting

- `502 Bad Gateway`: backend is not running. Check `pm2 status` and `pm2 logs veritascan-api`.
- Upload fails with large files: confirm `client_max_body_size 25M` exists in Nginx config.
- Login or API calls fail in browser: confirm `CLIENT_ORIGIN=https://your-domain.com` and restart PM2.
- Site opens but API does not: confirm Nginx has the `/api/` proxy block and backend listens on port `5001`.
- SSL fails: confirm Hostinger DNS `A` records point to the VPS IP before running Certbot.
