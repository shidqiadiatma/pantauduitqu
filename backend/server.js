import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import nodemailer from 'nodemailer'

const app = express()
const PORT = Number(process.env.PORT || 3001)
const pendingOtps = new Map()
const OTP_REQUIRED = String(process.env.OTP_REQUIRED || 'false').toLowerCase() === 'true'

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'pantauduitqu',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: false,
}

const pool = mysql.createPool(DB_CONFIG)

app.use(cors())
app.use(express.json())

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim())
const createOtp = () => String(Math.floor(100000 + Math.random() * 900000))

const smtpConfig = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || 'PantauDuitQu <noreply@example.com>',
}

const createSmtpTransporter = () => {
  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    return null
  }

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  })
}

const sendOtpEmail = async (email, otp) => {
  const transporter = createSmtpTransporter()

  if (!transporter) {
    console.log(`OTP untuk ${email}: ${otp}`)
    return { fallback: true }
  }

  const info = await transporter.sendMail({
    from: smtpConfig.from,
    to: email,
    subject: 'Kode OTP PantauDuitQu',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Kode OTP PantauDuitQu</h2>
        <p>Gunakan kode berikut untuk menyelesaikan pendaftaran:</p>
        <div style="padding: 16px 20px; background: #ecfeff; border-radius: 10px; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #0f172a;">
          ${otp}
        </div>
        <p style="margin-top: 12px;">Kode ini berlaku selama 5 menit.</p>
      </div>
    `,
  })

  return { fallback: false, info }
}

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
})

const escapeIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``

const initializeDatabase = async () => {
  const adminConnection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
  })

  try {
    const databaseName = DB_CONFIG.database
    await adminConnection.execute(`CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(databaseName)}`)
  } finally {
    await adminConnection.end()
  }

  const connection = await pool.getConnection()

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'superadmin') NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS investment_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nama_aset VARCHAR(255) NOT NULL,
        jenis_aset VARCHAR(255) NOT NULL,
        aplikasi VARCHAR(255) NOT NULL,
        jumlah DECIMAL(18, 4) NOT NULL DEFAULT 0,
        harga_beli DECIMAL(18, 2) NOT NULL DEFAULT 0,
        harga_sekarang DECIMAL(18, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_investment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS saving_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nama_aplikasi VARCHAR(255) NOT NULL,
        total_tabungan DECIMAL(18, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_saving_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await connection.execute('DELETE FROM investment_items')
    await connection.execute('DELETE FROM saving_items')
    await connection.execute('ALTER TABLE investment_items AUTO_INCREMENT = 1')
    await connection.execute('ALTER TABLE saving_items AUTO_INCREMENT = 1')

    const [existingAdmin] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', ['admin@tracker.com'])
    if (!existingAdmin.length) {
      await connection.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Super Admin', 'admin@tracker.com', await bcrypt.hash('admin123', 10), 'superadmin'],
      )
    }

    const [existingDemoUser] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', ['user@tracker.com'])
    if (!existingDemoUser.length) {
      await connection.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Demo User', 'user@tracker.com', await bcrypt.hash('user123', 10), 'user'],
      )
    }
  } finally {
    connection.release()
  }
}

const normalizeInvestmentRow = (item) => ({
  id: item.id,
  namaAset: item.nama_aset ?? item.namaAset ?? '',
  jenisAset: item.jenis_aset ?? item.jenisAset ?? '',
  aplikasi: item.aplikasi ?? '',
  jumlah: Number(item.jumlah ?? 0),
  hargaBeli: Number(item.harga_beli ?? item.hargaBeli ?? 0),
  hargaSekarang: Number(item.harga_sekarang ?? item.hargaSekarang ?? 0),
  nilaiInvestasi: Number(item.jumlah ?? 0) * Number(item.harga_beli ?? item.hargaBeli ?? 0),
  nilaiSekarang: Number(item.jumlah ?? 0) * Number(item.harga_sekarang ?? item.hargaSekarang ?? 0),
  untungRugi: (Number(item.jumlah ?? 0) * Number(item.harga_sekarang ?? item.hargaSekarang ?? 0)) - (Number(item.jumlah ?? 0) * Number(item.harga_beli ?? item.hargaBeli ?? 0)),
  persentase: Number(item.harga_beli ?? item.hargaBeli ?? 0) === 0 ? 0 : (((Number(item.harga_sekarang ?? item.hargaSekarang ?? 0) - Number(item.harga_beli ?? item.hargaBeli ?? 0)) / Number(item.harga_beli ?? item.hargaBeli ?? 0)) * 100),
})

const normalizeSavingRow = (item) => ({
  id: item.id,
  namaAplikasi: item.nama_aplikasi ?? item.namaAplikasi ?? '',
  totalTabungan: Number(item.total_tabungan ?? item.totalTabungan ?? 0),
})

const getUserPortfolio = async (userId) => {
  const [investmentRows] = await pool.execute(
    'SELECT * FROM investment_items WHERE user_id = ? ORDER BY id ASC',
    [userId],
  )

  const [savingRows] = await pool.execute(
    'SELECT * FROM saving_items WHERE user_id = ? ORDER BY id ASC',
    [userId],
  )

  return {
    investment: investmentRows.map(normalizeInvestmentRow),
    saving: savingRows.map(normalizeSavingRow),
  }
}

const getUserSummary = (portfolio) => {
  const investmentTotal = (portfolio?.investment || []).reduce((sum, item) => sum + Number(item.nilaiSekarang || 0), 0)
  const savingTotal = (portfolio?.saving || []).reduce((sum, item) => sum + Number(item.totalTabungan || 0), 0)

  return {
    investmentTotal,
    savingTotal,
    portfolioTotal: investmentTotal + savingTotal,
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/request-otp', async (req, res) => {
  const { email } = req.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Email tidak valid. Gunakan format email yang benar.' })
  }

  const [rows] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [normalizedEmail])

  if (rows.length) {
    return res.status(409).json({ message: 'Email sudah terdaftar.' })
  }

  const otp = createOtp()
  pendingOtps.set(normalizedEmail, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  })

  try {
    const sendResult = await sendOtpEmail(normalizedEmail, otp)
    if (sendResult.fallback) {
      console.log(`OTP untuk ${normalizedEmail}: ${otp} (fallback via console)`)
    }
  } catch (error) {
    console.error('Failed to send OTP email:', error)
  }

  res.json({
    message: `Kode OTP sudah dikirim ke ${normalizedEmail}.`,
    email: normalizedEmail,
  })
})

app.post('/api/register', async (req, res) => {
  const { name, email, password, otp } = req.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()

  if (!name || !normalizedEmail || !password || !otp) {
    return res.status(400).json({ message: 'Nama, email, password, dan OTP wajib diisi.' })
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Email tidak valid. Gunakan format email yang benar.' })
  }

  if (OTP_REQUIRED) {
    const otpRecord = pendingOtps.get(normalizedEmail)
    if (!otpRecord || Date.now() > otpRecord.expiresAt || String(otpRecord.otp) !== String(otp)) {
      return res.status(400).json({ message: 'OTP email tidak valid atau sudah kedaluwarsa.' })
    }
  }

  const [existingRows] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [normalizedEmail])

  if (existingRows.length) {
    pendingOtps.delete(normalizedEmail)
    return res.status(409).json({ message: 'Email sudah terdaftar.' })
  }

  const hashedPassword = await bcrypt.hash(String(password), 10)
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [String(name).trim(), normalizedEmail, hashedPassword, 'user'],
  )

  const [userRows] = await pool.execute(
    'SELECT id, name, email, role FROM users WHERE id = ?',
    [result.insertId],
  )

  pendingOtps.delete(normalizedEmail)
  res.status(201).json(sanitizeUser(userRows[0]))
})

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' })
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Email tidak valid. Gunakan format email yang benar.' })
  }

  const [rows] = await pool.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [normalizedEmail])

  if (!rows.length) {
    return res.status(401).json({ message: 'Akun tidak ditemukan.' })
  }

  const user = rows[0]
  const isPasswordValid = await bcrypt.compare(String(password), user.password)

  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Password salah.' })
  }

  res.json(sanitizeUser(user))
})

app.put('/api/profile/:userId', async (req, res) => {
  const userId = Number(req.params.userId)
  const trimmedName = String(req.body?.name || '').trim()

  if (!trimmedName) {
    return res.status(400).json({ message: 'Nama lengkap wajib diisi.' })
  }

  const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
  if (!userRows.length) {
    return res.status(404).json({ message: 'User tidak ditemukan.' })
  }

  const [result] = await pool.execute('UPDATE users SET name = ? WHERE id = ?', [trimmedName, userId])

  if (!result.affectedRows) {
    return res.status(400).json({ message: 'Gagal memperbarui nama profil.' })
  }

  const [rows] = await pool.execute('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [userId])
  res.json(sanitizeUser(rows[0]))
})

app.put('/api/profile/:userId/password', async (req, res) => {
  const userId = Number(req.params.userId)
  const trimmedPassword = String(req.body?.password || '').trim()

  if (!trimmedPassword || trimmedPassword.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter.' })
  }

  const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
  if (!userRows.length) {
    return res.status(404).json({ message: 'User tidak ditemukan.' })
  }

  const hashedPassword = await bcrypt.hash(trimmedPassword, 10)
  const [result] = await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId])

  if (!result.affectedRows) {
    return res.status(400).json({ message: 'Gagal memperbarui password.' })
  }

  res.json({ message: 'Password berhasil diperbarui.' })
})

app.get('/api/users', async (req, res) => {
  const [users] = await pool.execute('SELECT id, name, email, role FROM users ORDER BY id ASC')
  const [investmentTotals] = await pool.execute(
    'SELECT user_id, SUM(jumlah * harga_sekarang) AS investment_total FROM investment_items GROUP BY user_id',
  )
  const [savingTotals] = await pool.execute(
    'SELECT user_id, SUM(total_tabungan) AS saving_total FROM saving_items GROUP BY user_id',
  )

  const investmentMap = new Map()
  investmentTotals.forEach((item) => investmentMap.set(item.user_id, Number(item.investment_total || 0)))

  const savingMap = new Map()
  savingTotals.forEach((item) => savingMap.set(item.user_id, Number(item.saving_total || 0)))

  const response = users.map((user) => ({
    ...sanitizeUser(user),
    investmentTotal: investmentMap.get(user.id) || 0,
    savingTotal: savingMap.get(user.id) || 0,
    portfolioTotal: (investmentMap.get(user.id) || 0) + (savingMap.get(user.id) || 0),
    status: 'active',
  }))

  res.json(response)
})

app.get('/api/portfolio/:userId', async (req, res) => {
  const userId = Number(req.params.userId)
  const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])

  if (!userRows.length) {
    return res.status(404).json({ message: 'User tidak ditemukan.' })
  }

  const portfolio = await getUserPortfolio(userId)
  res.json(portfolio)
})

app.post('/api/portfolio/:userId/investment', async (req, res) => {
  const userId = Number(req.params.userId)
  const payload = req.body || {}

  const [result] = await pool.execute(
    'INSERT INTO investment_items (user_id, nama_aset, jenis_aset, aplikasi, jumlah, harga_beli, harga_sekarang) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      userId,
      payload.namaAset,
      payload.jenisAset,
      payload.aplikasi,
      Number(payload.jumlah || 0),
      Number(payload.hargaBeli || 0),
      Number(payload.hargaSekarang || 0),
    ],
  )

  const [rows] = await pool.execute('SELECT * FROM investment_items WHERE id = ? LIMIT 1', [result.insertId])
  res.status(201).json(normalizeInvestmentRow(rows[0]))
})

app.post('/api/portfolio/:userId/saving', async (req, res) => {
  const userId = Number(req.params.userId)
  const payload = req.body || {}

  const [result] = await pool.execute(
    'INSERT INTO saving_items (user_id, nama_aplikasi, total_tabungan) VALUES (?, ?, ?)',
    [userId, payload.namaAplikasi, Number(payload.totalTabungan || 0)],
  )

  const [rows] = await pool.execute('SELECT * FROM saving_items WHERE id = ? LIMIT 1', [result.insertId])
  res.status(201).json(normalizeSavingRow(rows[0]))
})

app.put('/api/portfolio/:userId/investment/:id', async (req, res) => {
  const userId = Number(req.params.userId)
  const itemId = Number(req.params.id)
  const payload = req.body || {}

  const [result] = await pool.execute(
    `UPDATE investment_items SET
      nama_aset = ?,
      jenis_aset = ?,
      aplikasi = ?,
      jumlah = ?,
      harga_beli = ?,
      harga_sekarang = ?
    WHERE id = ? AND user_id = ?`,
    [
      payload.namaAset,
      payload.jenisAset,
      payload.aplikasi,
      Number(payload.jumlah || 0),
      Number(payload.hargaBeli || 0),
      Number(payload.hargaSekarang || 0),
      itemId,
      userId,
    ],
  )

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Investment tidak ditemukan.' })
  }

  const [rows] = await pool.execute('SELECT * FROM investment_items WHERE id = ? LIMIT 1', [itemId])
  res.json(normalizeInvestmentRow(rows[0]))
})

app.put('/api/portfolio/:userId/saving/:id', async (req, res) => {
  const userId = Number(req.params.userId)
  const itemId = Number(req.params.id)
  const payload = req.body || {}

  const [result] = await pool.execute(
    'UPDATE saving_items SET nama_aplikasi = ?, total_tabungan = ? WHERE id = ? AND user_id = ?',
    [payload.namaAplikasi, Number(payload.totalTabungan || 0), itemId, userId],
  )

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Saving tidak ditemukan.' })
  }

  const [rows] = await pool.execute('SELECT * FROM saving_items WHERE id = ? LIMIT 1', [itemId])
  res.json(normalizeSavingRow(rows[0]))
})

app.delete('/api/portfolio/:userId/investment/:id', async (req, res) => {
  const userId = Number(req.params.userId)
  const itemId = Number(req.params.id)

  const [result] = await pool.execute('DELETE FROM investment_items WHERE id = ? AND user_id = ?', [itemId, userId])

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Investment tidak ditemukan.' })
  }

  res.status(204).send()
})

app.delete('/api/portfolio/:userId/saving/:id', async (req, res) => {
  const userId = Number(req.params.userId)
  const itemId = Number(req.params.id)

  const [result] = await pool.execute('DELETE FROM saving_items WHERE id = ? AND user_id = ?', [itemId, userId])

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Saving tidak ditemukan.' })
  }

  res.status(204).send()
})

initializeDatabase().catch((error) => {
  console.error('MySQL initialization failed:', error)
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Using MySQL database: ${DB_CONFIG.database} at ${DB_CONFIG.host}:${DB_CONFIG.port}`)
})
