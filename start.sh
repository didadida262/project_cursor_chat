#!/bin/bash

echo "🚀 正在启动加密频道项目..."
echo

# 检查Node.js版本
echo "🔍 检查Node.js版本..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

node --version
echo "✅ Node.js版本检查通过"
echo

# 检查依赖是否已安装的函数
check_dependencies() {
    echo "🔍 检查项目依赖..."

    # 检查根目录依赖
    if [ ! -d "node_modules" ]; then
        echo "⚠️ 根目录依赖未安装"
        return 1
    fi

    # 检查concurrently包是否存在
    if [ ! -d "node_modules/concurrently" ]; then
        echo "⚠️ 根目录 concurrently 包未安装"
        return 1
    fi

    # 检查服务端依赖
    if [ ! -d "server/node_modules" ]; then
        echo "⚠️ 服务端依赖未安装"
        return 1
    fi

    # 检查客户端依赖
    if [ ! -d "client/node_modules" ]; then
        echo "⚠️ 客户端依赖未安装"
        return 1
    fi

    # 检查关键前端依赖
    if [ ! -d "client/node_modules/react" ] || [ ! -d "client/node_modules/react-dom" ]; then
        echo "⚠️ 客户端核心依赖未完整安装"
        return 1
    fi

    # 检查关键后端依赖
    if [ ! -d "server/node_modules/express" ] || [ ! -d "server/node_modules/socket.io" ]; then
        echo "⚠️ 服务端核心依赖未完整安装"
        return 1
    fi

    echo "✅ 所有依赖已正确安装"
    return 0
}

# 检查依赖并决定是否需要安装
if check_dependencies; then
    echo "🎉 依赖检查通过，跳过安装步骤"
else
    echo
    echo "📦 检测到依赖缺失，开始安装..."
    # 使用本地缓存避免权限问题
    export npm_config_cache="$(pwd)/.npm-cache"

    if npm run install-all; then
        echo "✅ 依赖安装完成"
    else
        echo "❌ 依赖安装失败"
        echo
        echo "可能的原因："
        echo "1. 网络连接问题"
        echo "2. npm权限问题"
        echo "3. 磁盘空间不足"
        echo "4. Node.js版本不兼容"
        echo
        echo "请尝试以下解决方案："
        echo "1. 检查网络连接"
        echo "2. 清理npm缓存: npm cache clean --force"
        echo "3. 确保Node.js版本 >= 16.0"
        echo "4. 检查磁盘空间"
        exit 1
    fi
fi

echo
echo "🚀 启动开发服务器..."
echo "📱 客户端将在 http://localhost:3000 启动"
echo "🖥️  服务端将在 http://localhost:3001 启动"
echo
echo "💡 提示："
echo "   - 按 Ctrl+C 停止服务器"
echo "   - 如果端口被占用，请检查并关闭相关进程"
echo "   - 确保防火墙允许3000和3001端口访问"
echo

if npm run dev; then
    echo
    echo "✅ 服务器启动成功！"
else
    echo
    echo "❌ 服务器启动失败"
    echo
    echo "可能的原因："
    echo "1. 端口3000或3001被其他程序占用"
    echo "2. 依赖包安装不完整"
    echo "3. 防火墙阻止了端口访问"
    echo "4. 权限不足"
    echo
    echo "请尝试以下解决方案："
    echo "1. 检查端口占用: lsof -i :3000 -i :3001"
    echo "2. 关闭占用端口的程序"
    echo "3. 检查防火墙设置"
    echo "4. 重新安装依赖: npm run install-all"
    exit 1
fi
