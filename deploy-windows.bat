@echo off
echo === Rec0deD:88 Gaming Portal - Windows Deployment ===
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Please install Node.js 20 from https://nodejs.org/
    echo Then re-run this script.
    pause
    exit /b 1
)

echo Node.js version:
node --version

if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env and set your DATABASE_URL before continuing.
    echo Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/rec0ded88
    echo.
    pause
)

echo Installing dependencies...
call npm install

echo Pushing database schema...
call npx drizzle-kit push

echo Building application...
call npm run build

echo.
echo === Build Complete ===
echo.
echo To start the app: npm run start
echo App will be available at: http://localhost:5000
echo.
pause
