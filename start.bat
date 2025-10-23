@echo off
chcp 65001 >nul
echo 🚀 正在启动加密频道项目...
echo.

REM 检查Node.js版本
echo 🔍 检查Node.js版本...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    echo 提示: 请访问 https://nodejs.org 下载并安装Node.js
    pause
    exit /b 1
)

echo ✅ Node.js版本检查通过
echo.

REM 检查依赖是否已安装的函数
echo 🔍 检查项目依赖...

REM 检查根目录依赖
if not exist "node_modules" (
    echo ⚠️ 根目录依赖未安装
    goto :install_deps
)

REM 检查concurrently包
if not exist "node_modules\concurrently" (
    echo ⚠️ 根目录 concurrently 包未安装
    goto :install_deps
)

REM 检查服务端依赖
if not exist "server\node_modules" (
    echo ⚠️ 服务端依赖未安装
    goto :install_deps
)

REM 检查客户端依赖
if not exist "client\node_modules" (
    echo ⚠️ 客户端依赖未安装
    goto :install_deps
)

REM 检查关键前端依赖
if not exist "client\node_modules\react" (
    echo ⚠️ 客户端核心依赖未完整安装
    goto :install_deps
)
if not exist "client\node_modules\react-dom" (
    echo ⚠️ 客户端核心依赖未完整安装
    goto :install_deps
)

REM 检查关键后端依赖
if not exist "server\node_modules\express" (
    echo ⚠️ 服务端核心依赖未完整安装
    goto :install_deps
)
if not exist "server\node_modules\socket.io" (
    echo ⚠️ 服务端核心依赖未完整安装
    goto :install_deps
)

echo ✅ 所有依赖已正确安装
echo 🎉 依赖检查通过，跳过安装步骤
goto :start_server

:install_deps
echo.
echo 📦 检测到依赖缺失，开始安装...
echo 提示: 这可能需要几分钟时间，请耐心等待...

REM 设置本地缓存避免权限问题
set npm_config_cache=%cd%\.npm-cache

call npm run install-all
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败，请检查网络连接或权限问题
    echo 可能的原因:
    echo 1. 网络连接问题
    echo 2. npm权限问题
    echo 3. 磁盘空间不足
    echo.
    echo 请尝试:
    echo 1. 检查网络连接
    echo 2. 以管理员身份运行命令提示符
    echo 3. 清理npm缓存: npm cache clean --force
    pause
    exit /b 1
)

echo ✅ 依赖安装完成
goto :start_server

:start_server
echo.
echo 启动开发服务器...
echo 客户端将在 http://localhost:3000 启动
echo 服务端将在 http://localhost:3001 启动
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npm run dev
if %errorlevel% neq 0 (
    echo ❌ 启动失败，请检查端口是否被占用或依赖是否正确安装
    pause
    exit /b 1
)

pause
