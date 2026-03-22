#!/bin/bash
set -e

echo "=== Rec0deD:88 Gaming Portal - Linux Deployment ==="
echo ""

if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
fi

echo "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER rec0ded WITH PASSWORD 'rec0ded88pass';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE rec0ded88 OWNER rec0ded;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rec0ded88 TO rec0ded;" 2>/dev/null || true

if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    sed -i 's|postgresql://username:password@localhost:5432/rec0ded88|postgresql://rec0ded:rec0ded88pass@localhost:5432/rec0ded88|' .env
fi

echo "Installing dependencies..."
npm install

echo "Pushing database schema..."
npx drizzle-kit push

echo "Building application..."
npm run build

echo "Starting application..."
echo ""
echo "To run in foreground:  npm run start"
echo "To run with PM2:       pm2 start dist/index.js --name rec0ded88"
echo "To run with systemd:   see deploy/rec0ded88.service"
echo ""
echo "App will be available at: http://$(hostname -I | awk '{print $1}'):${PORT:-5000}"
