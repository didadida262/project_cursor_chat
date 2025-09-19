# 在线聊天室工具平台

一个基于React和Socket.io的实时聊天室平台，支持文本聊天和音视频通信功能。

## 功能特性

- 🗨️ 实时文本聊天
- 📹 音视频通话
- 👥 在线用户列表
- 📱 响应式设计
- 🌙 暗色/亮色主题
- 🚀 Vercel一键部署

## 技术栈

### 前端
- React 18
- Ant Design
- Socket.io Client
- WebRTC
- Styled Components
- Vite

### 后端
- Node.js
- Express
- Socket.io
- WebRTC信令服务

## 快速开始

### 1. 安装依赖

```bash
# 安装所有依赖（根目录、客户端、服务端）
npm run install-all
```

### 2. 开发环境运行

```bash
# 同时启动客户端和服务端
npm run dev

# 或者分别启动
npm run client  # 启动React开发服务器 (http://localhost:3000)
npm run server  # 启动Node.js服务器 (http://localhost:3001)
```

### 3. 生产环境构建

```bash
npm run build
npm start
```

## 部署到Vercel

### 方法一：Vercel CLI

```bash
# 安装Vercel CLI
npm i -g vercel

# 部署
vercel

# 生产环境部署
vercel --prod
```

### 方法二：GitHub集成

1. 将代码推送到GitHub仓库
2. 在Vercel控制台连接GitHub仓库
3. 配置构建设置：
   - Build Command: `npm run build`
   - Output Directory: `client/dist`
4. 部署

## 项目结构

```
├── client/                 # React前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── contexts/       # React上下文
│   │   └── App.jsx         # 主应用组件
│   ├── package.json
│   └── vite.config.js
├── server/                 # Node.js后端服务
│   ├── index.js           # 服务器入口文件
│   └── package.json
├── vercel.json            # Vercel部署配置
└── package.json           # 根目录配置
```

## API接口

### 用户管理
- `GET /api/users` - 获取在线用户列表
- `GET /api/messages` - 获取历史消息

### WebSocket事件
- `join` - 用户加入聊天室
- `message` - 发送消息
- `offer/answer` - WebRTC信令
- `ice-candidate` - ICE候选

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 开发说明

### 环境要求
- Node.js 16+
- npm 8+

### 开发流程
1. 修改代码后自动热重载
2. 客户端运行在 http://localhost:3000
3. 服务端运行在 http://localhost:3001
4. WebSocket连接自动建立

## 许可证

MIT License


