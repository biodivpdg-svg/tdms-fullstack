# 🐯 TDMS — Tiger Database Management System

Platform digital untuk monitoring, identifikasi, dan pengelolaan data individu harimau Sumatera.

---

## 📦 Tech Stack

| Layer       | Teknologi                              |
|-------------|----------------------------------------|
| Frontend    | Vanilla HTML/CSS/JS (served by Express)|
| Backend     | Node.js + Express.js                   |
| Database    | PostgreSQL 16                          |
| File Upload | Multer (local → mudah migrasi ke S3)   |
| Peta        | Leaflet.js + OpenStreetMap             |
| Charts      | Chart.js 4                             |
| Icons       | Tabler Icons                           |
| Deploy      | Docker + Docker Compose                |

---

## 🚀 Cara Menjalankan

### Opsi A — Docker Compose (Direkomendasikan)

Pastikan Docker & Docker Compose sudah terinstall.

```bash
# 1. Clone / extract project
cd tdms-fullstack

# 2. Jalankan semua layanan
docker compose up --build -d

# 3. Buka browser
open http://localhost:3001
```

> Database schema & seed data otomatis diinisialisasi saat container pertama kali berjalan.

**Menghentikan:**
```bash
docker compose down
```

**Melihat log:**
```bash
docker compose logs -f backend
```

---

### Opsi B — Manual (tanpa Docker)

#### Prasyarat
- Node.js 18+
- PostgreSQL 14+ (jalankan secara lokal)

#### 1. Setup Database

```bash
# Buat database
psql -U postgres -c "CREATE DATABASE tdms;"
psql -U postgres -c "CREATE USER tdms_user WITH PASSWORD 'tdms_pass_2024';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tdms TO tdms_user;"
```

#### 2. Konfigurasi Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` sesuai konfigurasi PostgreSQL lokal Anda:
```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tdms
DB_USER=tdms_user
DB_PASSWORD=tdms_pass_2024
```

#### 3. Install & Jalankan

```bash
cd backend
npm install

# Inisialisasi schema & seed data
npm run db:init

# Jalankan server
npm run dev       # mode development (nodemon)
# atau
npm start         # mode production
```

#### 4. Buka Aplikasi

```
http://localhost:3001
```

---

## 📁 Struktur Project

```
tdms-fullstack/
├── backend/
│   ├── config/
│   │   └── db.js              # Koneksi PostgreSQL
│   ├── db/
│   │   ├── schema.sql         # Definisi tabel + seed data
│   │   └── init.js            # Script inisialisasi DB
│   ├── middleware/
│   │   └── upload.js          # Multer file upload
│   ├── routes/
│   │   ├── tigers.js          # CRUD individu harimau
│   │   ├── sightings.js       # CRUD rekaman + upload
│   │   ├── dashboard.js       # Statistik & chart data
│   │   └── map.js             # GeoJSON untuk peta
│   ├── uploads/               # Foto & lampiran (gitignored)
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── server.js              # Entry point
├── frontend/
│   └── index.html             # SPA (served by Express)
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🔌 API Endpoints

### Tigers
| Method | Endpoint                      | Deskripsi                  |
|--------|-------------------------------|----------------------------|
| GET    | `/api/tigers`                 | List semua individu        |
| GET    | `/api/tigers/:code`           | Detail individu            |
| GET    | `/api/tigers/:code/sightings` | Semua rekaman individu     |
| POST   | `/api/tigers`                 | Tambah individu baru       |
| PATCH  | `/api/tigers/:code`           | Update individu            |
| DELETE | `/api/tigers/:code`           | Soft delete individu       |

### Sightings
| Method | Endpoint                              | Deskripsi                  |
|--------|---------------------------------------|----------------------------|
| GET    | `/api/sightings`                      | List rekaman (filter+page) |
| GET    | `/api/sightings/:id`                  | Detail rekaman             |
| POST   | `/api/sightings`                      | Tambah rekaman + foto      |
| PATCH  | `/api/sightings/:id`                  | Update rekaman             |
| DELETE | `/api/sightings/:id`                  | Hapus rekaman              |
| DELETE | `/api/sightings/:id/attachments/:aid` | Hapus lampiran             |
| GET    | `/api/sightings/export/csv`           | Export CSV                 |

### Dashboard
| Method | Endpoint                    | Deskripsi              |
|--------|-----------------------------|------------------------|
| GET    | `/api/dashboard/stats`      | Statistik ringkasan    |
| GET    | `/api/dashboard/monthly`    | Data chart bulanan     |
| GET    | `/api/dashboard/recent`     | Rekaman terbaru        |
| GET    | `/api/dashboard/top-tigers` | Top 5 individu         |

### Map
| Method | Endpoint          | Deskripsi              |
|--------|-------------------|------------------------|
| GET    | `/api/map/points` | GeoJSON semua titik    |

### Query Parameters (GET /api/sightings)
```
search      string    Cari tiger_code atau notes
sex         M|F|U     Filter jenis kelamin
tiger_code  string    Filter per individu
stripe_side left|right|both
date_from   YYYY-MM-DD
date_to     YYYY-MM-DD
page        number    Default: 1
per         number    Default: 50
sort        string    Kolom sortir (default: recorded_date)
order       asc|desc  Default: desc
```

---

## 🗄️ Schema Database

```sql
tigers (
  id UUID PK, tiger_code UNIQUE, name, sex, status,
  stripe_left_url, stripe_right_url,
  first_recorded_at, notes, created_at, updated_at
)

sightings (
  id SERIAL PK, tiger_id FK, tiger_code,
  sex, latitude, longitude, stripe_side,
  has_stripe_left, has_stripe_right,
  stripe_left_url, stripe_right_url,
  recorded_date, recorded_time, notes,
  created_at, updated_at
)

attachments (
  id SERIAL PK, sighting_id FK,
  side, file_url, file_type, file_size,
  original_name, created_at
)
```

---

## 🌐 Deploy ke Cloud

### Railway (Gratis, Mudah)
1. Buka [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Tambah PostgreSQL service
4. Set environment variables dari `.env.example`
5. Deploy!

### Render
1. Buka [render.com](https://render.com)
2. New Web Service → connect repo
3. Build Command: `cd backend && npm install`
4. Start Command: `cd backend && npm run db:init && npm start`
5. Tambah PostgreSQL database

### VPS (Ubuntu)
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone & jalankan
git clone <repo-url> tdms
cd tdms
docker compose up -d
```

---

## 📝 Lisensi
Internal use — Konservasi Harimau Sumatera
