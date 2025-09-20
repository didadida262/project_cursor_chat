#!/bin/bash

echo "🚀 启动本地开发环境（使用Neon数据库）"
echo

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误：未设置 DATABASE_URL 环境变量"
    echo
    echo "请设置你的Neon数据库连接字符串："
    echo "export DATABASE_URL='postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require'"
    echo
    echo "或者创建 .env.local 文件并添加："
    echo "DATABASE_URL=你的Neon数据库连接字符串"
    echo
    exit 1
fi

echo "✅ DATABASE_URL 已设置"
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
