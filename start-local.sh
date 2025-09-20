#!/bin/bash

echo "🚀 启动本地开发环境（使用Neon数据库）"
echo

echo "✅ 使用项目内置的Neon数据库配置"
echo

# 启动服务器
echo "🔄 启动服务器..."
cd server
gnome-terminal -- bash -c "npm start; exec bash" 2>/dev/null || xterm -e "npm start" 2>/dev/null || npm start &
cd ..

# 等待服务器启动
sleep 3

# 启动客户端
echo "🔄 启动客户端..."
cd client
gnome-terminal -- bash -c "npm run dev; exec bash" 2>/dev/null || xterm -e "npm run dev" 2>/dev/null || npm run dev &
cd ..

echo
echo "✅ 本地开发环境启动完成！"
echo "📱 客户端：http://localhost:5173"
echo "🔧 服务器：http://localhost:3002"
echo
