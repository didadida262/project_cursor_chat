#!/bin/bash

# 聊天室项目 Vercel 部署脚本

echo "🚀 开始部署聊天室项目到 Vercel..."

# 检查是否安装了 vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装，正在安装..."
    npm install -g vercel
fi

# 检查是否已登录
echo "🔐 检查 Vercel 登录状态..."
if ! vercel whoami &> /dev/null; then
    echo "请先登录 Vercel:"
    vercel login
fi

# 安装依赖
echo "📦 安装项目依赖..."
npm run install-all

# 构建客户端
echo "🔨 构建客户端..."
cd client
npm run build
cd ..

# 部署到 Vercel
echo "🚀 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo "🌐 访问你的聊天室链接开始聊天吧！"
