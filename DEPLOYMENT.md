# Vercel 部署指南

## 项目部署到 Vercel

这个聊天室项目已经配置好可以部署到 Vercel 平台。以下是详细的部署步骤：

### 1. 准备工作

确保你的项目包含以下文件：
- `vercel.json` - Vercel 配置文件
- `client/vercel.json` - 客户端构建配置
- 所有必要的依赖包已安装

### 2. 部署步骤

#### 方法一：通过 Vercel CLI 部署

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **在项目根目录部署**
   ```bash
   vercel
   ```

4. **跟随提示完成部署**
   - 选择项目名称
   - 确认构建设置
   - 等待部署完成

#### 方法二：通过 GitHub 部署

1. **将代码推送到 GitHub**
   ```bash
   git add .
   git commit -m "准备部署到 Vercel"
   git push origin main
   ```

2. **在 Vercel 网站操作**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "New Project"
   - 选择你的 GitHub 仓库
   - 确认构建设置
   - 点击 "Deploy"

### 3. 项目配置说明

#### 根目录 `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/socket.io/(.*)",
      "dest": "/server/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/client/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "server/index.js": {
      "maxDuration": 30
    }
  }
}
```

#### 客户端 `client/vercel.json`
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 4. 环境变量和数据库配置

项目会自动检测环境：
- **开发环境**: Socket 连接到 `http://localhost:3001`
- **生产环境**: Socket 连接到 `window.location.origin`

#### MongoDB Atlas 配置（消息持久化）

1. **创建 MongoDB Atlas 账户**：
   - 访问 [MongoDB Atlas](https://www.mongodb.com/atlas)
   - 注册免费账户
   - 创建新的集群（选择免费的 M0 套餐）

2. **配置数据库**：
   - 创建数据库用户
   - 设置网络访问权限（添加 0.0.0.0/0 允许所有IP）
   - 获取连接字符串

3. **设置环境变量**：
   - 在 Vercel 项目设置中添加环境变量：
   - `MONGODB_URI`: 你的 MongoDB Atlas 连接字符串

4. **消息存储特性**：
   - ✅ **持久化存储** - 消息永久保存，不会因服务器重启丢失
   - ✅ **自动同步** - 新用户加入时自动获取历史消息
   - ✅ **容量限制** - 自动保留最近1000条消息
   - ✅ **高可用性** - 99.9% 正常运行时间
   - ✅ **免费额度** - 512MB 免费存储空间

### 5. 部署后访问

部署完成后，你会得到一个 Vercel 提供的 URL，例如：
- `https://your-project-name.vercel.app`

### 6. 功能特性

部署后的聊天室支持：
- ✅ 实时文字聊天
- ✅ 在线用户列表
- ✅ 用户昵称设置
- ✅ 响应式设计
- ✅ 暗色主题
- ✅ 拖拽用户卡片
- ✅ 消息时间戳

### 7. 注意事项

1. **WebRTC 功能**: 当前版本主要专注于文字聊天功能
2. **用户数据**: 用户数据不会持久化存储，刷新页面会清空
3. **并发限制**: Vercel 免费版有函数执行时间限制
4. **HTTPS**: Vercel 自动提供 HTTPS 支持

### 8. 故障排除

如果部署遇到问题：

1. **检查构建日志**
   - 在 Vercel 控制台查看构建日志
   - 确保所有依赖都正确安装

2. **检查路由配置**
   - 确保 Socket.io 路由正确配置
   - 检查静态文件路由

3. **检查 CORS 设置**
   - 确保服务器 CORS 配置正确
   - 检查 Socket.io CORS 设置

### 9. 更新部署

当你修改代码后：
```bash
git add .
git commit -m "更新功能"
git push origin main
```

Vercel 会自动重新部署。

---

🎉 **部署完成后，你就可以分享链接给朋友，大家一起在线聊天了！**
