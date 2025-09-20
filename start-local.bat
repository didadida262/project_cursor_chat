@echo off
echo 🚀 启动本地开发环境（使用Neon数据库）
echo.

REM 检查环境变量
if "%DATABASE_URL%"=="" (
    echo ❌ 错误：未设置 DATABASE_URL 环境变量
    echo.
    echo 请设置你的Neon数据库连接字符串：
    echo set DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
    echo.
    echo 或者创建 .env.local 文件并添加：
    echo DATABASE_URL=你的Neon数据库连接字符串
    echo.
    pause
    exit /b 1
)

echo ✅ DATABASE_URL 已设置
echo.

REM 启动服务器
echo 🔄 启动服务器...
cd server
start "Chat Server" cmd /k "npm start"
cd ..

REM 等待服务器启动
timeout /t 3 /nobreak >nul

REM 启动客户端
echo 🔄 启动客户端...
cd client
start "Chat Client" cmd /k "npm run dev"
cd ..

echo.
echo ✅ 本地开发环境启动完成！
echo 📱 客户端：http://localhost:5173
echo 🔧 服务器：http://localhost:3002
echo.
pause
