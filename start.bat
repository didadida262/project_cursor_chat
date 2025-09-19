@echo off
echo 正在启动在线聊天室项目...
echo.

echo 检查Node.js版本...
node --version
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

echo.
echo 安装依赖包...
call npm run install-all

echo.
echo 启动开发服务器...
echo 客户端将在 http://localhost:3000 启动
echo 服务端将在 http://localhost:3001 启动
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npm run dev

pause
