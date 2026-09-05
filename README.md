# PantauDuitQu

PantauDuitQu adalah aplikasi dashboard personal finance untuk memantau investasi, tabungan, dan analisis risiko portofolio. Aplikasi ini dibangun dengan Vue 3, Express.js, dan MySQL, serta dilengkapi fitur autentikasi, profile, admin monitoring, dan dashboard analitik.

## Fitur utama
- Dashboard portofolio investasi dan tabungan
- CRUD aset investasi dan tabungan
- Login dan registrasi user
- Validasi OTP saat registrasi dengan dukungan SMTP real atau mode testing
- Role superadmin untuk monitoring pengguna
- Analisis risiko dan profit/loss
- Pagination untuk tabel data
- UI fintech dengan tampilan modern

## Tech stack
- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Database: MySQL 8
- Auth: bcryptjs
- Email OTP: nodemailer

## Prasyarat
Sebelum menjalankan project, pastikan perangkat sudah memiliki:
- Node.js 18+
- npm
- MySQL 8.0
- Git

## Setup environment
1. Clone project ke lokal
   ```bash
   git clone <repo-url>
   cd portfolio-saving-tracker
   ```

2. Install dependency
   ```bash
   npm install
   ```

3. Siapkan file environment
   Copy file `.env.example` menjadi `.env` lalu sesuaikan konfigurasi:

   ```bash
   copy .env.example .env
   ```

   Isi konfigurasi MySQL dan email sesuai environment Anda:

   ```env
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=pantauduitqu
   PORT=3001
   OTP_REQUIRED=true
   OTP_TEST_CODE=
   VITE_API_BASE_URL=http://localhost:3001/api

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-digit-app-password
   SMTP_FROM="PantauDuitQu <your-email@gmail.com>"
   ```

   Catatan:
   - `OTP_REQUIRED=true` mewajibkan OTP saat registrasi.
   - Kosongkan `OTP_TEST_CODE` untuk menggunakan OTP real melalui SMTP.
   - Isi `OTP_TEST_CODE=123456` hanya untuk mode testing tanpa SMTP.
   - Jangan commit `.env` atau membagikan `SMTP_PASS`.

### Konfigurasi Gmail SMTP
Untuk mengirim OTP real, aktifkan 2-Step Verification pada akun Gmail lalu buat Gmail App Password. Gunakan App Password, bukan password Gmail biasa.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-digit-app-password
SMTP_FROM="PantauDuitQu <your-email@gmail.com>"
OTP_REQUIRED=true
OTP_TEST_CODE=
```

Jika koneksi port 465 bermasalah, gunakan:

```env
SMTP_PORT=587
SMTP_SECURE=false
```

## Menyiapkan database MySQL
1. Pastikan MySQL Server sudah berjalan.
2. Buat database `pantauduitqu` jika belum ada.
3. Backend akan otomatis membuat table yang dibutuhkan saat pertama kali berjalan.

Contoh SQL:

```sql
CREATE DATABASE pantauduitqu;
```

## Menjalankan project
### 1) Jalankan backend
```bash
node backend/server.js
```

Backend akan berjalan di:
- http://localhost:3001

### 2) Jalankan frontend
```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

Aplikasi dapat dibuka di:
- http://127.0.0.1:4173

## Build untuk production
```bash
npm run build
```

## Deploy ke Render dan Vercel
### Backend di Render
Gunakan konfigurasi berikut:

```text
Build Command: npm install
Start Command: node backend/server.js
Root Directory: kosong
```

Environment variable database Render harus menggunakan host MySQL cloud, bukan `localhost`:

```env
PORT=10000
MYSQL_HOST=host-mysql-cloud
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password-mysql
MYSQL_DATABASE=railway
OTP_REQUIRED=true
OTP_TEST_CODE=123456
```

Gunakan `OTP_TEST_CODE=123456` hanya untuk testing. Untuk OTP real, hapus nilainya dan isi konfigurasi SMTP.

### Frontend di Vercel
Gunakan pengaturan:

```text
Framework Preset: Vite atau Other
Root Directory: kosong
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Tambahkan environment variable Vercel:

```env
VITE_API_BASE_URL=https://pantauduitqu-finance-portfolio-racker.onrender.com/api
```

Vercel akan menyediakan domain gratis dengan format `*.vercel.app`.

## Default akun
Saat database pertama kali dibuat, aplikasi akan otomatis membuat akun berikut:
- Admin
  - Email: `admin@tracker.com`
  - Password: `admin123`
- User demo
  - Email: `user@tracker.com`
  - Password: `user123`

## Struktur folder utama
```text
portfolio-saving-tracker/
├── backend/
│   └── server.js
├── public/
├── src/
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
├── vite.config.ts
└── ...
```

## Catatan penting
- Jangan commit file `.env` ke repository publik.
- Untuk email OTP production, gunakan Gmail App Password atau SMTP provider lain yang valid.
- Jika port 4173 atau 3001 sudah dipakai, ubah port sesuai kebutuhan.

## Git workflow
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <repo-url>
git push -u origin main
```

