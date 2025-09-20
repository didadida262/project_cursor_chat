# 本地开发环境配置指南

## 🎯 目标
配置本地开发环境使用与线上一致的Neon PostgreSQL数据库，确保本地和线上环境完全一致。

## 📋 配置步骤

### 1. 获取Neon数据库连接字符串

1. 登录 [Neon Console](https://console.neon.tech/)
2. 选择你的项目
3. 在 "Connection Details" 中复制连接字符串
4. 连接字符串格式：
   ```
   postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

### 2. 设置环境变量

#### Windows (PowerShell/CMD)
```bash
# 临时设置（当前会话有效）
set DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# 永久设置（推荐）
setx DATABASE_URL "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

#### macOS/Linux (Bash/Zsh)
```bash
# 临时设置（当前会话有效）
export DATABASE_URL='postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require'

# 永久设置（添加到 ~/.bashrc 或 ~/.zshrc）
echo 'export DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"' >> ~/.bashrc
source ~/.bashrc
```

### 3. 启动本地开发环境

#### Windows
```bash
# 使用提供的启动脚本
.\start-local.bat

# 或手动启动
cd server && npm start
# 新终端窗口
cd client && npm run dev
```

#### macOS/Linux
```bash
# 使用提供的启动脚本
./start-local.sh

# 或手动启动
cd server && npm start
# 新终端窗口
cd client && npm run dev
```

## 🔍 验证配置

### 检查数据库连接
1. 启动服务器后，查看控制台输出
2. 应该看到：
   ```
   ✅ PostgreSQL连接池创建成功
   🔄 数据库连接建立，开始初始化表...
   ```

### 测试API端点
访问：`http://localhost:3002/api/test-db`
应该返回数据库状态信息。

## 📁 项目结构

```
project_cursor_chat/
├── client/                 # 前端代码
├── server/                 # 后端代码
├── start-local.bat        # Windows启动脚本
├── start-local.sh         # macOS/Linux启动脚本
├── LOCAL_SETUP.md         # 本配置文档
└── vercel.json            # Vercel部署配置
```

## 🚨 注意事项

1. **数据一致性**：本地和线上使用同一数据库，数据会同步
2. **SSL连接**：Neon要求SSL连接，已自动配置
3. **环境变量**：确保DATABASE_URL正确设置
4. **端口冲突**：确保3002和5173端口未被占用

## 🐛 常见问题

### 问题1：数据库连接失败
```
❌ 错误：未设置 DATABASE_URL 环境变量
```
**解决方案**：按照步骤2设置环境变量

### 问题2：SSL连接错误
```
❌ PostgreSQL连接失败: SSL connection is required
```
**解决方案**：确保连接字符串包含 `?sslmode=require`

### 问题3：端口被占用
```
Error: listen EADDRINUSE: address already in use :::3002
```
**解决方案**：关闭占用端口的进程或修改端口配置

## 📞 技术支持

如果遇到问题，请检查：
1. 环境变量是否正确设置
2. 网络连接是否正常
3. Neon数据库是否可访问
4. 端口是否被占用
