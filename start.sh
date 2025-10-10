#!/bin/bash

echo "正在启动加密频道项目..."
echo

echo "检查Node.js版本..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

node --version

echo
echo "安装依赖包..."
npm run install-all

echo
echo "启动开发服务器..."
echo "客户端将在 http://localhost:3000 启动"
echo "服务端将在 http://localhost:3001 启动"
echo
echo "按 Ctrl+C 停止服务器"
echo

npm run dev
