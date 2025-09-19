@echo off
chcp 65001 >nul

echo 🚀 开始部署聊天室项目到 Vercel...

REM 检查是否安装了 vercel CLI
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI 未安装，正在安装...
    npm install -g vercel
)

REM 检查是否已登录
echo 🔐 检查 Vercel 登录状态...
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo 请先登录 Vercel:
    vercel login
)

REM 安装依赖
echo 📦 安装项目依赖...
call npm run install-all

REM 构建客户端
echo 🔨 构建客户端...
cd client
call npm run build
cd ..

REM 部署到 Vercel
echo 🚀 部署到 Vercel...
vercel --prod

echo ✅ 部署完成！
echo 🌐 访问你的聊天室链接开始聊天吧！

pause
