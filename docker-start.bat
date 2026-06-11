@echo off
echo JCB Tracker - Docker Baslangic
echo ===============================
echo.
echo 1. Docker Desktop kontrol ediliyor...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Docker Desktop calismiyor!
    echo.
    echo Lutfen Docker Desktop'i baslatin:
    echo   Windows Search ^> "Docker Desktop" ^> Enter
    echo.
    echo Indirme: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo [OK] Docker calisiyor
echo.
echo 2. Servisler baslatiliyor...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [HATA] Servisler baslatilamadi
    pause
    exit /b 1
)
echo [OK] Servisler calisiyor
echo.
echo 3. Bekleniyor (15sn)...
ping -n 15 127.0.0.1 >nul
echo.
echo ===============================
echo Web Panel: http://localhost:3000
echo EMQX Dashboard: http://localhost:18083
echo   (admin / public)
echo MongoDB: mongodb://localhost:27017
echo.
echo Giris: admin@jcbtracker.com / admin123
echo ===============================
echo.
echo Durdurmak icin: docker-compose down
echo.
pause
