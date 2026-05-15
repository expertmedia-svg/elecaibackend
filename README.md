# elecaibackend

Backend Node.js pour ELEC-AI.

## Demarrage local

```bash
npm install
npm start
```

Sondes utiles:

- `GET /health`
- `POST /api/diagnose`
- `POST /api/ask`
- `GET /api/history`

## Production avec PM2 + Nginx

Ce repo contient une configuration isolee pour ajouter ce service sans toucher aux autres sites deja en production.

### 1. Variables d'environnement

Creer un fichier `.env` sur la VM a partir de `.env.example` et definir au minimum:

```env
PORT=4451
NODE_ENV=production
OPENAI_API_KEY=...
MONGODB_URI=...
CORS_ORIGIN=https://elecaibackend.yingr-ai.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### 2. PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Le nom PM2 est `elecaibackend`, sur le port `4451`.

### 3. Nginx

Le fichier `deploy/nginx.elecaibackend.conf` est pret pour:

- `server_name elecaibackend.yingr-ai.com`
- proxy vers `127.0.0.1:4451`

Exemple d'activation sur Debian/Ubuntu:

```bash
sudo cp deploy/nginx.elecaibackend.conf /etc/nginx/sites-available/elecaibackend
sudo ln -s /etc/nginx/sites-available/elecaibackend /etc/nginx/sites-enabled/elecaibackend
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Verification

```bash
curl http://127.0.0.1:4451/health
curl -H "Host: elecaibackend.yingr-ai.com" http://127.0.0.1/health
pm2 logs elecaibackend --lines 50
```

Cette approche n'ecrase aucun autre service tant que tu n'utilises pas le meme `server_name`, le meme fichier Nginx, ou le meme port PM2.