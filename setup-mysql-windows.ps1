$ErrorActionPreference = 'Stop'

$mysqlPath = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
$mysqlAdmin = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqladmin.exe'
$databaseName = 'pantauduitqu'

if (-not (Test-Path $mysqlPath)) {
    Write-Host 'MySQL client tidak ditemukan di lokasi default: ' $mysqlPath
    Write-Host 'Pastikan MySQL Server sudah terinstall dan jalur bin benar.'
    exit 1
}

if (-not (Test-Path $mysqlAdmin)) {
    Write-Host 'MySQL admin tidak ditemukan di lokasi default: ' $mysqlAdmin
    exit 1
}

$mysqlUser = Read-Host 'Masukkan username MySQL (default: root)'
if (-not $mysqlUser) { $mysqlUser = 'root' }

$mysqlPassword = Read-Host 'Masukkan password MySQL' -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($mysqlPassword)
$mysqlPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$env:MYSQL_USER = $mysqlUser
$env:MYSQL_PASSWORD = $mysqlPasswordPlain
$env:MYSQL_DATABASE = $databaseName

$connectionString = "mysql --host=127.0.0.1 --user=$mysqlUser --password=$mysqlPasswordPlain -e \"CREATE DATABASE IF NOT EXISTS $databaseName;\""
Invoke-Expression $connectionString

Write-Host ""
Write-Host 'Database MySQL siap digunakan.'
Write-Host "Database: $databaseName"
Write-Host "User: $mysqlUser"
Write-Host ""
Write-Host 'Selanjutnya, buat file .env berdasarkan .env.example lalu jalankan:'
Write-Host '  node backend/server.js'
Write-Host '  atau gunakan npm run dev'
