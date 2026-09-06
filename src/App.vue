<script setup>
import { computed, onMounted, ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://pantauduitqu-finance-portfolio-racker.onrender.com/api'
const USER_STORAGE_KEY = 'portfolio-saving-tracker.currentUser'
const API_TIMEOUT_MS = 10000

const fetchWithTimeout = async (url, options = {}, timeoutMs = API_TIMEOUT_MS) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

const loadStoredUser = () => {
  try {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY)
    return storedUser ? JSON.parse(storedUser) : null
  } catch (error) {
    console.error('Failed to load stored user:', error)
    return null
  }
}

const defaultInvestmentData = []
const defaultSavingData = []

const authMode = ref('login')
const authForm = ref({ name: '', email: '', password: '' })
const otpCode = ref('')
const otpState = ref('idle')
const otpMessage = ref('')
const authError = ref('')
const authSuccess = ref('')
const currentUser = ref(loadStoredUser())
const adminUsers = ref([])
const selectedUserDetail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const profileMenuOpen = ref(false)
const profileView = ref(false)
const profileForm = ref({ name: '', email: '', password: '' })
const profileMessage = ref('')
const profileError = ref('')
const passwordDialog = ref({ open: false, newPassword: '', confirmPassword: '' })

const investmentData = ref([...defaultInvestmentData])
const savingData = ref([...defaultSavingData])

const fetchInvestmentData = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/investment`)
    if (!response.ok) throw new Error('Failed to load investment data')

    const investment = await response.json()
    investmentData.value = Array.isArray(investment) ? investment : []
  } catch (error) {
    console.error('Failed to fetch investment data from backend:', error)
  }
}

const fetchSavingData = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/saving`)
    if (!response.ok) throw new Error('Failed to load saving data')

    const saving = await response.json()
    savingData.value = Array.isArray(saving) ? saving : []
  } catch (error) {
    console.error('Failed to fetch saving data from backend:', error)
  }
}

const fetchUserPortfolio = async () => {
  if (!currentUser.value) return

  try {
    const response = await fetchWithTimeout(`${API_BASE}/portfolio/${currentUser.value.id}`)
    if (!response.ok) throw new Error('Failed to load user portfolio')

    const portfolio = await response.json()
    investmentData.value = Array.isArray(portfolio?.investment) ? portfolio.investment : []
    savingData.value = Array.isArray(portfolio?.saving) ? portfolio.saving : []
  } catch (error) {
    console.error('Failed to fetch user portfolio:', error)
  }
}

const fetchAdminData = async () => {
  if (!currentUser.value || currentUser.value.role !== 'superadmin') return

  try {
    const response = await fetchWithTimeout(`${API_BASE}/users`)
    if (!response.ok) throw new Error('Failed to load admin users')

    adminUsers.value = await response.json()
  } catch (error) {
    console.error('Failed to fetch admin users:', error)
    adminUsers.value = []
  }
}

const fetchData = async () => {
  if (!currentUser.value) return

  if (currentUser.value.role === 'superadmin') {
    await fetchAdminData()
    return
  }

  await fetchUserPortfolio()
}

const requestOtp = async () => {
  authError.value = ''
  const email = authForm.value.email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    authError.value = 'Email tidak valid. Gunakan format email yang benar.'
    return
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE}/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Gagal mengirim OTP')
    }

    otpState.value = 'sent'
    otpMessage.value = data.message
    otpCode.value = ''
  } catch (error) {
    authError.value = error.message || 'Gagal mengirim OTP.'
    otpState.value = 'idle'
    otpMessage.value = ''
  }
}

const switchAuthMode = () => {
  authMode.value = authMode.value === 'login' ? 'register' : 'login'
  authForm.value = { name: '', email: '', password: '' }
  otpCode.value = ''
  otpState.value = 'idle'
  otpMessage.value = ''
  authError.value = ''
  authSuccess.value = ''
}

const handleAuthSubmit = async () => {
  authError.value = ''

  if (authMode.value === 'register') {
    const email = authForm.value.email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      authError.value = 'Email tidak valid. Gunakan format email yang benar.'
      return
    }

    if (otpState.value !== 'sent' || !otpCode.value.trim()) {
      authError.value = 'Silakan kirim dan masukkan OTP email sebelum mendaftar.'
      return
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authForm.value.name,
          email,
          password: authForm.value.password,
          otp: otpCode.value.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registrasi gagal')
      }

      authMode.value = 'login'
      authForm.value = { name: '', email: '', password: '' }
      otpCode.value = ''
      otpState.value = 'idle'
      otpMessage.value = ''
      authError.value = ''
      authSuccess.value = 'Registrasi berhasil. Silakan login.'
      return
    } catch (error) {
      authSuccess.value = ''
      authError.value = error.message || 'Registrasi gagal.'
      return
    }
  }

  try {
    const email = authForm.value.email.trim().toLowerCase()
    const payload = { email, password: authForm.value.password }

    const response = await fetchWithTimeout(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Authentication failed')
    }

    currentUser.value = data
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data))
    authForm.value = { name: '', email: '', password: '' }
    otpCode.value = ''
    otpState.value = 'idle'
    otpMessage.value = ''

    if (data.role === 'superadmin') {
      await fetchAdminData()
    } else {
      await fetchUserPortfolio()
    }
  } catch (error) {
    authError.value = error.message || 'Terjadi kesalahan autentikasi.'
  }
}

const toggleProfileMenu = () => {
  profileMenuOpen.value = !profileMenuOpen.value
}

const closeProfileMenu = () => {
  profileMenuOpen.value = false
}

const openProfilePage = () => {
  profileMenuOpen.value = false
  profileView.value = true
  profileMessage.value = ''
  profileError.value = ''
  profileForm.value = {
    name: currentUser.value?.name || '',
    email: currentUser.value?.email || '',
    password: '',
  }
}

const closeProfilePage = () => {
  profileView.value = false
  profileMessage.value = ''
  profileError.value = ''
  passwordDialog.value = { open: false, newPassword: '', confirmPassword: '' }
}

const updateProfile = async () => {
  if (!currentUser.value) return

  const trimmedName = profileForm.value.name.trim()
  if (!trimmedName) {
    profileError.value = 'Nama lengkap wajib diisi.'
    return
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE}/profile/${currentUser.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmedName }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Gagal memperbarui profil.')
    }

    currentUser.value = { ...currentUser.value, name: data.name }
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser.value))
    profileForm.value.name = data.name
    profileMessage.value = 'Nama lengkap berhasil diperbarui.'
    profileError.value = ''
  } catch (error) {
    profileError.value = error.message || 'Terjadi kesalahan saat memperbarui profil.'
  }
}

const openPasswordDialog = () => {
  passwordDialog.value = {
    open: true,
    newPassword: '',
    confirmPassword: '',
  }
  profileError.value = ''
  profileMessage.value = ''
}

const closePasswordDialog = () => {
  passwordDialog.value = {
    open: false,
    newPassword: '',
    confirmPassword: '',
  }
}

const updatePassword = async () => {
  if (!currentUser.value) return

  const newPassword = passwordDialog.value.newPassword.trim()
  const confirmPassword = passwordDialog.value.confirmPassword.trim()

  if (!newPassword || newPassword.length < 6) {
    profileError.value = 'Password baru minimal 6 karakter.'
    return
  }

  if (newPassword !== confirmPassword) {
    profileError.value = 'Konfirmasi password tidak cocok.'
    return
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE}/profile/${currentUser.value.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Gagal memperbarui password.')
    }

    profileMessage.value = 'Password berhasil diperbarui.'
    profileError.value = ''
    closePasswordDialog()
  } catch (error) {
    profileError.value = error.message || 'Terjadi kesalahan saat memperbarui password.'
  }
}

const logout = () => {
  profileMenuOpen.value = false
  profileView.value = false
  currentUser.value = null
  localStorage.removeItem(USER_STORAGE_KEY)
  authMode.value = 'login'
  authError.value = ''
  profileError.value = ''
  profileMessage.value = ''
  adminUsers.value = []
  investmentData.value = []
  savingData.value = []
  resetInvestmentForm()
  resetSavingForm()
}

onMounted(() => {
  fetchData()
})

const investmentForm = ref({
  id: null,
  namaAset: '',
  jenisAset: '',
  aplikasi: '',
  jumlah: '',
  hargaBeli: '',
  hargaSekarang: '',
})

const savingForm = ref({
  id: null,
  namaAplikasi: '',
  totalTabungan: '',
})

const confirmModal = ref({
  open: false,
  type: 'investment',
  title: 'Konfirmasi Hapus',
  message: '',
  targetId: null,
})

const investmentRows = computed(() =>
  investmentData.value.map((item) => {
    const nilaiInvestasi = item.jumlah * item.hargaBeli
    const nilaiSekarang = item.jumlah * item.hargaSekarang
    const untungRugi = nilaiSekarang - nilaiInvestasi
    const persentase = nilaiInvestasi === 0 ? 0 : (untungRugi / nilaiInvestasi) * 100

    return {
      ...item,
      nilaiInvestasi,
      nilaiSekarang,
      untungRugi,
      persentase,
    }
  }),
)

const totalInvestasiNilaiSaatIni = computed(() =>
  investmentRows.value.reduce((sum, row) => sum + row.nilaiSekarang, 0),
)

const totalSaving = computed(() =>
  savingData.value.reduce((sum, item) => sum + item.totalTabungan, 0),
)

const totalPortfolio = computed(() => totalInvestasiNilaiSaatIni.value + totalSaving.value)

const totalInvestmentCost = computed(() =>
  investmentRows.value.reduce((sum, row) => sum + row.nilaiInvestasi, 0),
)

const totalPortfolioProfitLoss = computed(() => {
  const nominal = totalInvestasiNilaiSaatIni.value - totalInvestmentCost.value
  const percent = totalInvestmentCost.value === 0 ? 0 : (nominal / totalInvestmentCost.value) * 100

  return {
    nominal,
    percent,
    label: nominal >= 0 ? 'Profit' : 'Loss',
    className: nominal >= 0 ? 'profit-badge' : 'loss-badge',
  }
})

const riskProfileLevels = [
  {
    label: 'Conservative',
    level: 'Low',
    className: 'conservative',
    description: 'Disarankan 70-80% aset aman seperti tabungan, reksadana pendapatan tetap, dan emas. Sisanya 20-30% untuk aset tumbuh agar tetap memberi potensi kenaikan.',
  },
  {
    label: 'Moderate',
    level: 'Medium',
    className: 'moderate',
    description: 'Disarankan 50-60% aset aman dan 40-50% aset tumbuh seperti saham, reksadana campuran, atau crypto dengan porsi terukur.',
  },
  {
    label: 'Agresif',
    level: 'High',
    className: 'aggressive',
    description: 'Disarankan 20-30% aset aman dan 70-80% aset berisiko tinggi seperti saham, crypto, dan reksadana saham untuk pertumbuhan maksimal.',
  },
]

const portfolioRiskProfile = computed(() => {
  const total = totalPortfolio.value || 1
  const investmentShare = totalInvestasiNilaiSaatIni.value / total
  const riskAssetScore = investmentData.value.reduce((score, item) => {
    if (['Cryptocurrency', 'Saham', 'Reksadana Saham', 'Reksadana Campuran'].includes(item.jenisAset)) {
      return score + 1
    }
    if (['Reksadana Pendapatan Tetap', 'Reksadana Pasar Uang', 'Logam Mulia'].includes(item.jenisAset)) {
      return score + 0.5
    }
    return score
  }, 0)

  const riskIndex = Math.min(1, (investmentShare * 0.7) + (riskAssetScore / Math.max(investmentData.value.length || 1, 1)) * 0.3)

  if (riskIndex >= 0.7) {
    return riskProfileLevels[2]
  }

  if (riskIndex >= 0.35) {
    return riskProfileLevels[1]
  }

  return riskProfileLevels[0]
})

const chartGradient = computed(() => {
  const total = totalPortfolio.value || 1
  const investmentPercent = (totalInvestasiNilaiSaatIni.value / total) * 100
  const savingPercent = (totalSaving.value / total) * 100
  return `conic-gradient(#5b8cff 0 ${investmentPercent}%, #22c55e ${investmentPercent}% ${investmentPercent + savingPercent}%, #e2e8f0 0)`
})

const investmentTypePalette = ['#60a5fa', '#5eead4', '#fbbf24', '#a78bfa', '#f472b6', '#34d399', '#f87171']

const hoveredInvestmentAsset = ref(null)
const hoveredPortfolioAsset = ref(null)
const investmentTooltipPosition = ref({ x: 0, y: 0 })
const portfolioTooltipPosition = ref({ x: 0, y: 0 })
const investmentChartGroup = ref('namaAset')
const riskInfoVisible = ref(false)
const PAGE_SIZE = 5
const adminPage = ref(1)
const investmentPage = ref(1)
const savingPage = ref(1)

const investmentCompositionOptions = [
  { value: 'namaAset', label: 'Nama Aset' },
  { value: 'jenisAset', label: 'Jenis Aset' },
  { value: 'aplikasi', label: 'Aplikasi' },
]

const resetInvestmentChartFilter = () => {
  investmentChartGroup.value = 'namaAset'
}

const portfolioSegments = computed(() => [
  { label: 'Investasi', value: totalInvestasiNilaiSaatIni.value, percent: totalPortfolio.value ? (totalInvestasiNilaiSaatIni.value / totalPortfolio.value) * 100 : 0, color: '#5b8cff' },
  { label: 'Tabungan', value: totalSaving.value, percent: totalPortfolio.value ? (totalSaving.value / totalPortfolio.value) * 100 : 0, color: '#22c55e' },
])

const portfolioChartSegments = computed(() => {
  const total = portfolioSegments.value.reduce((sum, item) => sum + item.value, 0) || 1
  const circumference = 2 * Math.PI * 88
  let offset = 0

  return portfolioSegments.value.map((segment) => {
    const length = (segment.value / total) * circumference
    const item = {
      ...segment,
      circumference,
      length,
      offset,
    }
    offset += length
    return item
  })
})

const investmentChartSegments = computed(() => {
  const total = investmentAssetBreakdown.value.reduce((sum, item) => sum + item.value, 0) || 1
  const circumference = 2 * Math.PI * 88
  let offset = 0

  return investmentAssetBreakdown.value.map((segment) => {
    const length = (segment.value / total) * circumference
    const item = {
      ...segment,
      circumference,
      length,
      offset,
    }
    offset += length
    return item
  })
})

const setPortfolioSegmentHover = (segment, event) => {
  const chart = event.currentTarget.closest('.donut-chart')
  const rect = chart.getBoundingClientRect()

  hoveredPortfolioAsset.value = segment
  portfolioTooltipPosition.value = {
    x: event.clientX - rect.left + 14,
    y: event.clientY - rect.top - 16,
  }
}

const setInvestmentSegmentHover = (segment, event) => {
  const chart = event.currentTarget.closest('.donut-chart')
  const rect = chart.getBoundingClientRect()

  hoveredInvestmentAsset.value = segment
  investmentTooltipPosition.value = {
    x: event.clientX - rect.left + 14,
    y: event.clientY - rect.top - 16,
  }
}

const investmentAssetBreakdown = computed(() => {
  const total = investmentRows.value.reduce((sum, row) => sum + row.nilaiSekarang, 0) || 1
  const grouped = new Map()

  investmentRows.value.forEach((row, index) => {
    const key = row[investmentChartGroup.value] || 'Lainnya'
    const label = String(key)
    const previous = grouped.get(label)
    const value = (previous?.value || 0) + row.nilaiSekarang

    grouped.set(label, {
      label,
      value,
      percent: (value / total) * 100,
      color: previous?.color || investmentTypePalette[index % investmentTypePalette.length],
    })
  })

  const allItems = Array.from(grouped.values()).sort((a, b) => b.value - a.value)
  const visibleItems = []
  let otherValue = 0

  allItems.forEach((item) => {
    if (item.percent <= 3) {
      otherValue += item.value
      return
    }

    visibleItems.push(item)
  })

  if (otherValue > 0) {
    visibleItems.push({
      label: 'Other',
      value: otherValue,
      percent: (otherValue / total) * 100,
      color: '#94a3b8',
    })
  }

  return visibleItems.sort((a, b) => b.value - a.value)
})

const adminPageCount = computed(() => Math.max(1, Math.ceil(adminUsers.value.length / PAGE_SIZE)))
const investmentPageCount = computed(() => Math.max(1, Math.ceil(investmentRows.value.length / PAGE_SIZE)))
const savingPageCount = computed(() => Math.max(1, Math.ceil(savingData.value.length / PAGE_SIZE)))

const paginatedAdminUsers = computed(() => {
  const totalPages = adminPageCount.value
  const safePage = Math.min(adminPage.value, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  return adminUsers.value.slice(start, start + PAGE_SIZE)
})

const paginatedInvestmentRows = computed(() => {
  const totalPages = investmentPageCount.value
  const safePage = Math.min(investmentPage.value, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  return investmentRows.value.slice(start, start + PAGE_SIZE)
})

const paginatedSavingData = computed(() => {
  const totalPages = savingPageCount.value
  const safePage = Math.min(savingPage.value, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  return savingData.value.slice(start, start + PAGE_SIZE)
})

const investmentCompositionGradient = computed(() => {
  const total = investmentAssetBreakdown.value.reduce((sum, item) => sum + item.value, 0) || 1

  let start = 0
  const segments = investmentAssetBreakdown.value.map((item) => {
    const percent = (item.value / total) * 100
    const end = start + percent
    const segment = `${item.color} ${start}% ${end}%`
    start = end
    return segment
  })

  return `conic-gradient(${segments.join(', ')})`
})

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)

const formatAmountInput = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? Number(digits).toLocaleString('id-ID') : ''
}

const parseAmountInput = (value) => Number(String(value ?? '').replace(/\./g, ''))

const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

const resetInvestmentForm = () => {
  investmentForm.value = {
    id: null,
    namaAset: '',
    jenisAset: '',
    aplikasi: '',
    jumlah: '',
    hargaBeli: '',
    hargaSekarang: '',
  }
}

const resetSavingForm = () => {
  savingForm.value = {
    id: null,
    namaAplikasi: '',
    totalTabungan: '',
  }
}

const updateAmountInput = (form, field, event) => {
  form.value[field] = formatAmountInput(event.target.value)
}

const addOrUpdateInvestment = async () => {
  if (!currentUser.value) return

  const payload = {
    namaAset: investmentForm.value.namaAset.trim(),
    jenisAset: investmentForm.value.jenisAset.trim(),
    aplikasi: investmentForm.value.aplikasi.trim(),
    jumlah: Number(investmentForm.value.jumlah),
    hargaBeli: parseAmountInput(investmentForm.value.hargaBeli),
    hargaSekarang: parseAmountInput(investmentForm.value.hargaSekarang),
  }

  if (!payload.namaAset || !payload.jenisAset || !payload.aplikasi || payload.jumlah <= 0 || payload.hargaBeli <= 0 || payload.hargaSekarang <= 0) {
    return
  }

  try {
    const id = investmentForm.value.id
    const url = id
      ? `${API_BASE}/portfolio/${currentUser.value.id}/investment/${id}`
      : `${API_BASE}/portfolio/${currentUser.value.id}/investment`

    const method = id ? 'PUT' : 'POST'

    const response = await fetchWithTimeout(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id: id ?? Date.now() }),
    })

    if (!response.ok) throw new Error('Failed to save investment data')

    await fetchUserPortfolio()
    resetInvestmentForm()
  } catch (error) {
    console.error('Investment save failed:', error)
  }
}

const addOrUpdateSaving = async () => {
  if (!currentUser.value) return

  const payload = {
    namaAplikasi: savingForm.value.namaAplikasi.trim(),
    totalTabungan: parseAmountInput(savingForm.value.totalTabungan),
  }

  if (!payload.namaAplikasi || payload.totalTabungan <= 0) {
    return
  }

  try {
    const id = savingForm.value.id
    const url = id
      ? `${API_BASE}/portfolio/${currentUser.value.id}/saving/${id}`
      : `${API_BASE}/portfolio/${currentUser.value.id}/saving`

    const method = id ? 'PUT' : 'POST'

    const response = await fetchWithTimeout(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id: id ?? Date.now() }),
    })

    if (!response.ok) throw new Error('Failed to save saving data')

    await fetchUserPortfolio()
    resetSavingForm()
  } catch (error) {
    console.error('Saving save failed:', error)
  }
}

const editInvestment = (item) => {
  investmentForm.value = {
    ...item,
    hargaBeli: formatAmountInput(item.hargaBeli),
    hargaSekarang: formatAmountInput(item.hargaSekarang),
  }
}

const confirmDelete = (type, id, label) => {
  confirmModal.value = {
    open: true,
    type,
    title: type === 'investment' ? 'Hapus Aset' : 'Hapus Tabungan',
    message: `Apakah Anda yakin ingin menghapus ${type === 'investment' ? 'aset' : 'tabungan'} "${label}"?`,
    targetId: id,
  }
}

const deleteInvestment = (id) => {
  const item = investmentData.value.find((record) => record.id === id)
  confirmDelete('investment', id, item?.namaAset || 'aset ini')
}

const proceedDelete = async () => {
  if (!currentUser.value) return

  try {
    if (confirmModal.value.type === 'investment') {
      const response = await fetchWithTimeout(`${API_BASE}/portfolio/${currentUser.value.id}/investment/${confirmModal.value.targetId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete investment failed')
      await fetchUserPortfolio()
    } else {
      const response = await fetchWithTimeout(`${API_BASE}/portfolio/${currentUser.value.id}/saving/${confirmModal.value.targetId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete saving failed')
      await fetchUserPortfolio()
    }
  } catch (error) {
    console.error('Delete failed:', error)
  }

  closeConfirmModal()
}

const closeConfirmModal = () => {
  confirmModal.value = {
    open: false,
    type: 'investment',
    title: 'Konfirmasi Hapus',
    message: '',
    targetId: null,
  }
}

const editSaving = (item) => {
  savingForm.value = {
    ...item,
    totalTabungan: formatAmountInput(item.totalTabungan),
  }
}

const deleteSaving = (id) => {
  const item = savingData.value.find((record) => record.id === id)
  confirmDelete('saving', id, item?.namaAplikasi || 'tabungan ini')
}

const openUserDetail = async (user) => {
  detailLoading.value = true
  detailError.value = ''

  try {
    const response = await fetchWithTimeout(`${API_BASE}/portfolio/${user.id}`)
    if (!response.ok) throw new Error('Gagal mengambil detail portfolio user')

    const portfolio = await response.json()
    selectedUserDetail.value = {
      user,
      portfolio,
    }
  } catch (error) {
    detailError.value = error.message || 'Gagal memuat detail portfolio.'
    selectedUserDetail.value = null
  } finally {
    detailLoading.value = false
  }
}

const closeUserDetail = () => {
  selectedUserDetail.value = null
  detailError.value = ''
}
</script>

<template>
  <div v-if="!currentUser" class="auth-shell">
    <div class="auth-card">
      <div class="brand-mark" aria-label="PantauDuitQu logo">
        <img src="/pantauduitqu-logo.svg" alt="PantauDuitQu logo" />
      </div>
      <div class="auth-header">
        <p class="eyebrow">PantauDuitQu</p>
        <h1>{{ authMode === 'login' ? 'Masuk ke akun' : 'Buat akun baru' }}</h1>
      </div>

      <form class="auth-form" @submit.prevent="handleAuthSubmit">
        <label v-if="authMode === 'register'">
          <span>Nama Lengkap</span>
          <input v-model="authForm.name" type="text" placeholder="Masukkan nama" required />
        </label>

        <label>
          <span>Email</span>
          <input v-model="authForm.email" type="email" placeholder="contoh@email.com" required />
        </label>

        <div v-if="authMode === 'register'" class="otp-row">
          <button type="button" class="secondary-btn otp-button" @click="requestOtp">Kirim OTP</button>
        </div>

        <p v-if="otpMessage" class="otp-success">{{ otpMessage }}</p>

        <label v-if="authMode === 'register' && otpState === 'sent'">
          <span>OTP Email</span>
          <input v-model="otpCode" type="text" inputmode="numeric" maxlength="6" placeholder="Masukkan 6 digit OTP" required />
        </label>

        <label>
          <span>Password</span>
          <input v-model="authForm.password" type="password" placeholder="Masukkan password" required />
        </label>

        <p v-if="authError" class="auth-error">{{ authError }}</p>
        <p v-if="authSuccess" class="auth-success">{{ authSuccess }}</p>

        <button type="submit" class="primary-btn auth-submit">
          {{ authMode === 'login' ? 'Login' : 'Verifikasi & Daftar' }}
        </button>
      </form>

      <div class="auth-switch">
        <span>{{ authMode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?' }}</span>
        <button type="button" class="switch-button" @click="switchAuthMode">
          {{ authMode === 'login' ? 'Daftar sekarang' : 'Masuk di sini' }}
        </button>
      </div>
    </div>
  </div>

  <div v-else-if="currentUser.role === 'superadmin'" class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Super Admin</p>
        <h1>Portal Monitoring User</h1>
      </div>
      <div class="topbar-actions">
        <div class="profile-menu-wrap">
          <button type="button" class="profile-trigger" @click="toggleProfileMenu">
            <span class="profile-avatar">{{ currentUser?.name?.charAt(0)?.toUpperCase() || 'A' }}</span>
            <span>{{ currentUser?.name || 'Admin' }}</span>
            <span class="profile-caret">▾</span>
          </button>
          <div v-if="profileMenuOpen" class="profile-menu">
            <button type="button" class="profile-menu-item" @click="openProfilePage">Profil</button>
            <button type="button" class="profile-menu-item danger" @click="logout">Logout</button>
          </div>
        </div>
      </div>
    </header>

    <main class="dashboard">
      <section class="summary-grid">
        <article class="summary-card primary">
          <span>Jumlah User Aktif</span>
          <strong>{{ totalUsers }}</strong>
        </article>
        <article class="summary-card success">
          <span>Total Investment Semua User</span>
          <strong>{{ formatCurrency(totalAdminInvestment) }}</strong>
        </article>
        <article class="summary-card neutral">
          <span>Total Saving Semua User</span>
          <strong>{{ formatCurrency(totalAdminSaving) }}</strong>
        </article>
      </section>

      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Daftar</p>
            <h2>List User Aktif</h2>
          </div>
        </div>

        <div class="table-wrap">
          <div class="table-meta">
            <span>View {{ paginatedAdminUsers.length }} data of {{ adminUsers.length }}</span>
            <div class="pagination-controls">
              <button type="button" class="tiny-btn" :disabled="adminPage === 1" @click="adminPage = Math.max(1, adminPage - 1)">Prev</button>
              <span>Page {{ adminPage }} / {{ adminPageCount }}</span>
              <button type="button" class="tiny-btn" :disabled="adminPage >= adminPageCount" @click="adminPage = Math.min(adminPageCount, adminPage + 1)">Next</button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Investment</th>
                <th>Saving</th>
                <th>Portfolio</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in paginatedAdminUsers" :key="user.id">
                <td>{{ user.name }}</td>
                <td>{{ user.email }}</td>
                <td>{{ user.role }}</td>
                <td>{{ formatCurrency(user.investmentTotal || 0) }}</td>
                <td>{{ formatCurrency(user.savingTotal || 0) }}</td>
                <td>{{ formatCurrency(user.portfolioTotal || 0) }}</td>
                <td class="action-cell">
                  <button class="tiny-btn edit" type="button" @click="openUserDetail(user)">Detail</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <div v-if="selectedUserDetail" class="detail-overlay" @click.self="closeUserDetail">
      <div class="detail-dialog" role="dialog" aria-modal="true">
        <div class="detail-header">
          <div>
            <p class="eyebrow">Portfolio</p>
            <h3>{{ selectedUserDetail.user.name }}</h3>
          </div>
          <button type="button" class="secondary-btn" @click="closeUserDetail">Tutup</button>
        </div>

        <div v-if="detailLoading" class="detail-state">Memuat detail portfolio...</div>
        <div v-else-if="detailError" class="detail-state error">{{ detailError }}</div>
        <div v-else class="detail-content">
          <div class="detail-summary">
            <div class="summary-pill">
              <span>Investment</span>
              <strong>{{ formatCurrency((selectedUserDetail.portfolio?.investment || []).reduce((sum, item) => sum + (Number(item.jumlah || 0) * Number(item.hargaSekarang || 0)), 0)) }}</strong>
            </div>
            <div class="summary-pill">
              <span>Saving</span>
              <strong>{{ formatCurrency((selectedUserDetail.portfolio?.saving || []).reduce((sum, item) => sum + Number(item.totalTabungan || 0), 0)) }}</strong>
            </div>
            <div class="summary-pill">
              <span>Portfolio</span>
              <strong>{{ formatCurrency(((selectedUserDetail.portfolio?.investment || []).reduce((sum, item) => sum + (Number(item.jumlah || 0) * Number(item.hargaSekarang || 0)), 0)) + ((selectedUserDetail.portfolio?.saving || []).reduce((sum, item) => sum + Number(item.totalTabungan || 0), 0))) }}</strong>
            </div>
          </div>

          <div class="detail-section">
            <h4>Investment</h4>
            <div v-if="(selectedUserDetail.portfolio?.investment || []).length" class="detail-list">
              <div v-for="item in selectedUserDetail.portfolio.investment" :key="item.id" class="detail-item">
                <div>
                  <strong>{{ item.namaAset }}</strong>
                  <small>{{ item.jenisAset }} • {{ item.aplikasi }}</small>
                </div>
                <span>{{ formatCurrency(Number(item.jumlah || 0) * Number(item.hargaSekarang || 0)) }}</span>
              </div>
            </div>
            <p v-else class="empty-state">Belum ada data investment.</p>
          </div>

          <div class="detail-section">
            <h4>Saving</h4>
            <div v-if="(selectedUserDetail.portfolio?.saving || []).length" class="detail-list">
              <div v-for="item in selectedUserDetail.portfolio.saving" :key="item.id" class="detail-item">
                <div>
                  <strong>{{ item.namaAplikasi }}</strong>
                </div>
                <span>{{ formatCurrency(Number(item.totalTabungan || 0)) }}</span>
              </div>
            </div>
            <p v-else class="empty-state">Belum ada data saving.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="profileView" class="app-shell profile-page-shell">
    <header class="topbar">
      <div class="brand-row">
        <img class="brand-icon" src="/pantauduitqu-logo.svg" alt="PantauDuitQu logo" />
        <div>
          <p class="eyebrow">Profil</p>
          <h1>Pengaturan Akun</h1>
        </div>
      </div>
      <div class="topbar-actions">
        <button class="secondary-btn" type="button" @click="closeProfilePage">Kembali</button>
      </div>
    </header>

    <main class="profile-page">
      <section class="panel profile-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Akun</p>
            <h2>Data Profil</h2>
          </div>
        </div>

        <form class="profile-form" @submit.prevent="updateProfile">
          <label>
            <span>Nama Lengkap</span>
            <input v-model="profileForm.name" type="text" placeholder="Masukkan nama lengkap" />
          </label>

          <label>
            <span>Email</span>
            <input v-model="profileForm.email" type="email" disabled />
          </label>

          <div class="profile-actions">
            <button type="submit" class="primary-btn">Simpan Nama</button>
            <button type="button" class="secondary-btn" @click="openPasswordDialog">Edit Password</button>
          </div>

          <p v-if="profileMessage" class="profile-success">{{ profileMessage }}</p>
          <p v-if="profileError" class="profile-error">{{ profileError }}</p>
        </form>
      </section>
    </main>
  </div>

  <div v-else class="app-shell">
    <header class="topbar">
      <div class="brand-row">
        <img class="brand-icon" src="/pantauduitqu-logo.svg" alt="PantauDuitQu logo" />
        <div>
          <p class="eyebrow">Dashboard</p>
          <h1>PantauDuitQu</h1>
        </div>
      </div>
      <div class="topbar-actions">
        <div class="profile-menu-wrap">
          <button type="button" class="profile-trigger" @click="toggleProfileMenu">
            <span class="profile-avatar">{{ currentUser?.name?.charAt(0)?.toUpperCase() || 'U' }}</span>
            <span>{{ currentUser?.name || 'User' }}</span>
            <span class="profile-caret">▾</span>
          </button>
          <div v-if="profileMenuOpen" class="profile-menu">
            <button type="button" class="profile-menu-item" @click="openProfilePage">Profil</button>
            <button type="button" class="profile-menu-item danger" @click="logout">Logout</button>
          </div>
        </div>
      </div>
    </header>

    <main class="dashboard">
      <section class="summary-grid">
        <article class="summary-card primary">
          <span>Total Investasi</span>
          <strong>{{ formatCurrency(totalInvestasiNilaiSaatIni) }}</strong>
        </article>
        <article class="summary-card success">
          <span>Total Tabungan</span>
          <strong>{{ formatCurrency(totalSaving) }}</strong>
        </article>
        <article class="summary-card neutral">
          <span>Total Portfolio</span>
          <strong>{{ formatCurrency(totalPortfolio) }}</strong>
        </article>
        <article class="summary-card profit-card" :class="totalPortfolioProfitLoss.className">
          <span>Profit / Loss</span>
          <div class="profit-overview-badge" :class="totalPortfolioProfitLoss.className">
            <span>{{ totalPortfolioProfitLoss.label }}</span>
            <strong>{{ formatPercent(totalPortfolioProfitLoss.percent) }}</strong>
            <small>{{ formatCurrency(totalPortfolioProfitLoss.nominal) }}</small>
          </div>
        </article>
        <article class="summary-card risk-card" :class="portfolioRiskProfile.className">
          <div class="risk-header">
            <span>Analisis Risiko</span>
            <button
              type="button"
              class="risk-info-btn"
              aria-label="Informasi level risiko"
              @click="riskInfoVisible = !riskInfoVisible"
              @blur="riskInfoVisible = false"
            >
              i
            </button>
          </div>

          <div class="risk-summary">
            <strong>{{ portfolioRiskProfile.label }}</strong>
            <span class="risk-level-badge">{{ portfolioRiskProfile.level }}</span>
          </div>

          <div v-if="riskInfoVisible" class="risk-info-tooltip">
            <div v-for="risk in riskProfileLevels" :key="`${risk.label}-${risk.level}`" class="risk-level-item">
              <strong>{{ risk.label }} - {{ risk.level }}</strong>
              <span>{{ risk.description }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="content-grid">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Aset</p>
              <h2>Investment</h2>
            </div>
          </div>

          <form class="entry-form" @submit.prevent="addOrUpdateInvestment">
            <div class="form-grid">
              <label>
                <span>Nama Aset</span>
                <input v-model="investmentForm.namaAset" type="text" placeholder="Contoh: BBCA" required />
              </label>
              <label>
                <span>Jenis Aset</span>
                <select v-model="investmentForm.jenisAset" required>
                  <option value="" disabled>Pilih jenis aset</option>
                  <option value="Saham">Saham</option>
                  <option value="Reksadana Pendapatan Tetap">Reksadana Pendapatan Tetap</option>
                  <option value="Reksadana Pasar Uang">Reksadana Pasar Uang</option>
                  <option value="Reksadana Saham">Reksadana Saham</option>
                  <option value="Reksadana Campuran">Reksadana Campuran</option>
                  <option value="Cryptocurrency">Cryptocurrency</option>
                  <option value="Logam Mulia">Logam Mulia</option>
                </select>
              </label>
              <label>
                <span>Aplikasi</span>
                <input v-model="investmentForm.aplikasi" type="text" placeholder="Contoh: Stockbit" required />
              </label>
              <label>
                <span>Jumlah</span>
                <input v-model="investmentForm.jumlah" type="number" min="0" step="any" inputmode="decimal" required />
              </label>
              <label>
                <span>Harga Beli</span>
                <input
                  v-model="investmentForm.hargaBeli"
                  type="text"
                  inputmode="numeric"
                  placeholder="Contoh: 6.000.000"
                  required
                  @input="updateAmountInput(investmentForm, 'hargaBeli', $event)"
                />
              </label>
              <label>
                <span>Harga Sekarang</span>
                <input
                  v-model="investmentForm.hargaSekarang"
                  type="text"
                  inputmode="numeric"
                  placeholder="Contoh: 9.000.000"
                  required
                  @input="updateAmountInput(investmentForm, 'hargaSekarang', $event)"
                />
              </label>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary-btn">
                {{ investmentForm.id ? 'Update Investasi' : 'Tambah Investasi' }}
              </button>
              <button v-if="investmentForm.id" type="button" class="secondary-btn" @click="resetInvestmentForm">
                Batal
              </button>
            </div>
          </form>

          <div class="table-wrap">
            <div class="table-meta">
              <span>View {{ paginatedInvestmentRows.length }} data of {{ investmentRows.length }}</span>
              <div class="pagination-controls">
                <button type="button" class="tiny-btn" :disabled="investmentPage === 1" @click="investmentPage = Math.max(1, investmentPage - 1)">Prev</button>
                <span>Page {{ investmentPage }} / {{ investmentPageCount }}</span>
                <button type="button" class="tiny-btn" :disabled="investmentPage >= investmentPageCount" @click="investmentPage = Math.min(investmentPageCount, investmentPage + 1)">Next</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nama Aset</th>
                  <th>Jenis Aset</th>
                  <th>Aplikasi</th>
                  <th>Jumlah</th>
                  <th>Harga Beli</th>
                  <th>Harga Sekarang</th>
                  <th>Nilai Investasi</th>
                  <th>Nilai Sekarang</th>
                  <th>Untung/Rugi</th>
                  <th>Persentase</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in paginatedInvestmentRows" :key="row.id">
                  <td>{{ row.namaAset }}</td>
                  <td>{{ row.jenisAset }}</td>
                  <td>{{ row.aplikasi }}</td>
                  <td>{{ Number(row.jumlah).toLocaleString('id-ID') }}</td>
                  <td>{{ formatCurrency(row.hargaBeli) }}</td>
                  <td>{{ formatCurrency(row.hargaSekarang) }}</td>
                  <td>{{ formatCurrency(row.nilaiInvestasi) }}</td>
                  <td>{{ formatCurrency(row.nilaiSekarang) }}</td>
                  <td :class="row.untungRugi >= 0 ? 'positive' : 'negative'">
                    <div class="profit-stack">
                      <span>{{ formatCurrency(row.untungRugi) }}</span>
                      <small>{{ formatPercent(row.persentase) }}</small>
                    </div>
                  </td>
                  <td :class="row.persentase >= 0 ? 'positive' : 'negative'">
                    {{ formatPercent(row.persentase) }}
                  </td>
                  <td class="action-cell">
                    <button class="tiny-btn edit" @click="editInvestment(row)">Edit</button>
                    <button class="tiny-btn delete" @click="deleteInvestment(row.id)">Hapus</button>
                  </td>
                </tr>
                <tr class="total-row">
                  <td colspan="3"><strong>Total</strong></td>
                  <td><strong>-</strong></td>
                  <td>-</td>
                  <td>-</td>
                  <td><strong>{{ formatCurrency(investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) }}</strong></td>
                  <td><strong>{{ formatCurrency(totalInvestasiNilaiSaatIni) }}</strong></td>
                  <td :class="(totalInvestasiNilaiSaatIni - investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) >= 0 ? 'positive' : 'negative'">
                    <div class="profit-stack total-profit">
                      <strong>{{ formatCurrency(totalInvestasiNilaiSaatIni - investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) }}</strong>
                      <small>
                        {{ formatPercent((investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0) === 0) ? 0 : ((totalInvestasiNilaiSaatIni - investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) / investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) * 100) }}
                      </small>
                    </div>
                  </td>
                  <td :class="(totalInvestasiNilaiSaatIni - investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) >= 0 ? 'positive' : 'negative'">
                    <strong>
                      {{ formatPercent((investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0) === 0) ? 0 : ((totalInvestasiNilaiSaatIni - investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) / investmentRows.reduce((sum, item) => sum + item.nilaiInvestasi, 0)) * 100) }}
                    </strong>
                  </td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel chart-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Visualisasi</p>
              <h2>Komposisi Investasi</h2>
            </div>
          </div>

          <div class="chart-wrap">
            <div class="donut-chart investment-donut">
              <svg class="donut-svg" viewBox="0 0 260 260" role="img" aria-label="Komposisi investasi">
                <g transform="rotate(-90 130 130)">
                  <circle
                    v-for="segment in investmentChartSegments"
                    :key="segment.label"
                    class="chart-segment"
                    :class="{ 'is-active': hoveredInvestmentAsset && hoveredInvestmentAsset.label === segment.label }"
                    cx="130"
                    cy="130"
                    r="88"
                    :stroke="segment.color"
                    stroke-width="36"
                    :stroke-dasharray="`${segment.length} ${segment.circumference - segment.length}`"
                    :stroke-dashoffset="`${-segment.offset}`"
                    fill="none"
                    @mouseenter="setInvestmentSegmentHover(segment, $event)"
                    @mousemove="setInvestmentSegmentHover(segment, $event)"
                    @mouseleave="hoveredInvestmentAsset = null"
                  />
                </g>
              </svg>

              <div class="donut-center">
                <span>Investasi</span>
                <strong>{{ formatCurrency(totalInvestasiNilaiSaatIni) }}</strong>
              </div>
            </div>

            <div
              v-if="hoveredInvestmentAsset"
              class="chart-tooltip"
              :style="{ left: `${investmentTooltipPosition.x}px`, top: `${investmentTooltipPosition.y}px` }"
            >
              <strong>{{ hoveredInvestmentAsset.label }}</strong>
              <span>{{ hoveredInvestmentAsset.percent.toFixed(1) }}%</span>
            </div>
          </div>

          <div class="chart-filter-group chart-filter-below">
            <label class="chart-filter">
              <span>Kelompokkan</span>
              <select v-model="investmentChartGroup">
                <option v-for="option in investmentCompositionOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <button
              type="button"
              class="secondary-btn chart-reset-btn"
              :disabled="investmentChartGroup === 'namaAset'"
              @click="resetInvestmentChartFilter"
            >
              Reset
            </button>
          </div>

          <div class="legend">
            <div v-for="item in investmentAssetBreakdown" :key="item.label" class="legend-item">
              <span class="legend-dot" :style="{ background: item.color }"></span>
              <span>{{ item.label }}</span>
              <strong>{{ item.percent.toFixed(1) }}%</strong>
              <small>{{ formatCurrency(item.value) }}</small>
            </div>
          </div>
        </div>
      </section>

      <section class="bottom-grid">
        <div class="panel saving-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Dana</p>
              <h2>Saving</h2>
            </div>
          </div>

          <form class="entry-form compact" @submit.prevent="addOrUpdateSaving">
            <div class="form-grid single-row">
              <label>
                <span>Nama Aplikasi</span>
                <input v-model="savingForm.namaAplikasi" type="text" placeholder="Contoh: BRI" required />
              </label>
              <label>
                <span>Jumlah Tabungan</span>
                <input
                  v-model="savingForm.totalTabungan"
                  type="text"
                  inputmode="numeric"
                  placeholder="Contoh: 6.000.000"
                  required
                  @input="updateAmountInput(savingForm, 'totalTabungan', $event)"
                />
              </label>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary-btn">
                {{ savingForm.id ? 'Update Tabungan' : 'Tambah Tabungan' }}
              </button>
              <button v-if="savingForm.id" type="button" class="secondary-btn" @click="resetSavingForm">
                Batal
              </button>
            </div>
          </form>

          <div class="table-wrap">
            <div class="table-meta">
              <span>View {{ paginatedSavingData.length }} data of {{ savingData.length }}</span>
              <div class="pagination-controls">
                <button type="button" class="tiny-btn" :disabled="savingPage === 1" @click="savingPage = Math.max(1, savingPage - 1)">Prev</button>
                <span>Page {{ savingPage }} / {{ savingPageCount }}</span>
                <button type="button" class="tiny-btn" :disabled="savingPage >= savingPageCount" @click="savingPage = Math.min(savingPageCount, savingPage + 1)">Next</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nama Aplikasi</th>
                  <th>Jumlah Tabungan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in paginatedSavingData" :key="item.id">
                  <td>{{ item.namaAplikasi }}</td>
                  <td>{{ formatCurrency(item.totalTabungan) }}</td>
                  <td class="action-cell">
                    <button class="tiny-btn edit" @click="editSaving(item)">Edit</button>
                    <button class="tiny-btn delete" @click="deleteSaving(item.id)">Hapus</button>
                  </td>
                </tr>
                <tr class="total-row">
                  <td><strong>Total Keseluruhan</strong></td>
                  <td><strong>{{ formatCurrency(totalSaving) }}</strong></td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel chart-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Visualisasi</p>
              <h2>Komposisi Portfolio</h2>
            </div>
          </div>

          <div class="chart-wrap">
            <div class="donut-chart portfolio-donut">
              <svg class="donut-svg" viewBox="0 0 260 260" role="img" aria-label="Komposisi portfolio">
                <g transform="rotate(-90 130 130)">
                  <circle
                    v-for="segment in portfolioChartSegments"
                    :key="segment.label"
                    class="chart-segment"
                    :class="{ 'is-active': hoveredPortfolioAsset && hoveredPortfolioAsset.label === segment.label }"
                    cx="130"
                    cy="130"
                    r="88"
                    :stroke="segment.color"
                    stroke-width="36"
                    :stroke-dasharray="`${segment.length} ${segment.circumference - segment.length}`"
                    :stroke-dashoffset="`${-segment.offset}`"
                    fill="none"
                    @mouseenter="setPortfolioSegmentHover(segment, $event)"
                    @mousemove="setPortfolioSegmentHover(segment, $event)"
                    @mouseleave="hoveredPortfolioAsset = null"
                  />
                </g>
              </svg>

              <div class="donut-center">
                <span>Total</span>
                <strong>{{ formatCurrency(totalPortfolio) }}</strong>
              </div>
            </div>

            <div
              v-if="hoveredPortfolioAsset"
              class="chart-tooltip"
              :style="{ left: `${portfolioTooltipPosition.x}px`, top: `${portfolioTooltipPosition.y}px` }"
            >
              <strong>{{ hoveredPortfolioAsset.label }}</strong>
              <span>{{ hoveredPortfolioAsset.percent.toFixed(1) }}%</span>
            </div>
          </div>

          <div class="legend">
            <div class="legend-item">
              <span class="legend-dot blue"></span>
              <span>Investasi</span>
              <strong>{{ formatCurrency(totalInvestasiNilaiSaatIni) }}</strong>
            </div>
            <div class="legend-item">
              <span class="legend-dot green"></span>
              <span>Tabungan</span>
              <strong>{{ formatCurrency(totalSaving) }}</strong>
            </div>
          </div>
        </div>
      </section>
    </main>

    <div v-if="confirmModal.open" class="confirm-overlay" @click.self="closeConfirmModal">
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <div class="confirm-icon">!</div>
        <h3>{{ confirmModal.title }}</h3>
        <p>{{ confirmModal.message }}</p>
        <div class="confirm-actions">
          <button type="button" class="cancel-btn" @click="closeConfirmModal">Batal</button>
          <button type="button" class="danger-btn" @click="proceedDelete">Hapus</button>
        </div>
      </div>
    </div>
  </div>
</template>
