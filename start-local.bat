@echo off
echo 🚀 启动本地开发环境（使用Neon数据库）
echo.

echo ✅ 使用项目内置的Neon数据库配置
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
