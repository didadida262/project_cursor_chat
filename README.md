# 加密频道工具平台

一个基于React和Socket.io的实时聊天室平台，支持文本聊天和音视频通信功能。采用现代化的技术栈，提供了完整的响应式设计，支持多设备访问。

## 🚀 项目特性

- **🔥 实时通信**: 基于Socket.io的毫秒级消息传输
- **📹 音视频通话**: WebRTC P2P点对点音视频通信
- **📱 响应式设计**: 支持桌面、平板、手机等所有设备
- **👥 用户管理**: 智能的用户在线状态管理
- **💾 数据持久化**: PostgreSQL数据库支持
- **🌐 一键部署**: Vercel平台自动部署
- **🎨 现代化UI**: Ant Design + 自定义样式

## 功能特性

- 🗨️ 实时文本聊天
- 📹 音视频通话
- 👥 在线用户列表
- 📱 响应式设计
- 🌙 暗色/亮色主题
- 🚀 Vercel一键部署

## 🛠️ 技术栈

### 前端技术
- **React 18** - 现代化的前端框架
- **Vite** - 快速的构建工具和开发服务器
- **Ant Design** - 企业级UI组件库
- **Socket.io Client** - WebSocket实时通信
- **WebRTC** - 点对点音视频通信
- **Styled Components** - CSS-in-JS样式解决方案

### 后端技术
- **Node.js** - 高性能服务器运行环境
- **Express.js** - 轻量级Web框架
- **Socket.io** - 双向实时通信框架
- **PostgreSQL (Neon)** - 云原生关系型数据库
- **UUID** - 唯一标识符生成
- **CORS** - 跨域资源共享

## 快速开始

### 1. 数据库配置
**✅ 已完成**：本地开发环境已内置Neon PostgreSQL数据库配置，无需额外设置。

### 2. 安装依赖

```bash
# 安装所有依赖（根目录、客户端、服务端）
npm run install-all
```

### 3. 开发环境运行

#### 使用启动脚本（推荐）
```bash
# Windows
.\start-local.bat

# macOS/Linux
./start-local.sh
```

#### 手动启动
```bash
# 启动服务端（端口3002）
cd server && npm start

# 启动客户端（端口5173）
cd client && npm run dev
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

## 📁 项目架构

### 目录结构
```
📦 加密频道工具平台
├── 📱 client/                    # React前端应用
│   ├── 📂 src/
│   │   ├── 📂 components/         # UI组件
│   │   │   ├── 🎯 CurrentUserCard.jsx    # 当前用户卡片
│   │   │   ├── 👤 OtherUserCard.jsx     # 其他用户卡片
│   │   │   ├── 🎨 SimpleUserCard.jsx    # 简化用户卡片
│   │   │   ├── 🎮 DraggableCurrentUserCard.jsx # 可拖拽用户卡片
│   │   │   ├── 💬 SimpleChatRoom.jsx    # 简化聊天室
│   │   │   ├── 🎬 VideoCall.jsx         # 视频通话组件
│   │   │   └── 🌟 ParticleBackground.jsx # 粒子背景
│   │   ├── 📂 contexts/           # React上下文
│   │   │   └── 🔌 SocketContext.jsx     # Socket连接上下文
│   │   ├── 📂 utils/              # 工具函数
│   │   │   ├── 🌐 SimpleChatAPI.js      # 聊天API封装
│   │   │   └── 🎥 MediaCoordinator.js   # 媒体协调器
│   │   ├── 🎨 App.jsx             # 主应用组件
│   │   ├── 🎨 App.css             # 全局样式
│   │   └── 📄 main.jsx            # 应用入口
│   ├── 📦 package.json            # 前端依赖配置
│   └── ⚙️ vite.config.js          # Vite构建配置
│
├── 🖥️ server/                    # Node.js后端服务
│   ├── 🚀 index.js                # 服务器入口文件
│   └── 📦 package.json            # 后端依赖配置
│
├── 🚀 vercel.json                # Vercel部署配置
├── 📦 package.json               # 根目录配置和脚本
├── 📝 README.md                  # 项目说明文档
├── 🏗️ start.sh                   # Linux/macOS启动脚本
├── 🏁 start.bat                  # Windows启动脚本
└── 📋 PRD.md                     # 产品需求文档
```

### 架构特点
- **前后端分离**: 清晰的架构边界，易于维护和扩展
- **组件化设计**: React组件高度复用和模块化
- **状态管理**: 基于React Hooks和Context的轻量级状态管理
- **实时通信**: Socket.io实现服务器推送
- **数据库持久化**: PostgreSQL确保数据不丢失

## 🔌 API接口文档

### 用户管理API
- **`POST /api/check-nickname`** - 检查昵称是否可用
- **`POST /api/join`** - 用户加入聊天室
- **`POST /api/leave`** - 用户离开聊天室
- **`GET /api/users`** - 获取在线用户列表（排除指定用户）
- **`GET /api/db-users`** - 获取数据库用户状态对比

### 消息管理API
- **`POST /api/message`** - 发送文本消息
- **`GET /api/messages`** - 获取历史消息记录

### 系统管理API
- **`GET /health`** - 服务器健康检查
- **`GET /api/test-db`** - 数据库连接测试
- **`POST /api/clear-users`** - 清空所有用户（测试用）

### WebSocket事件
- **`join`** - 用户加入聊天室
- **`message`** - 发送文本消息
- **`offer`** - WebRTC视频通话请求
- **`answer`** - WebRTC视频通话应答
- **`ice-candidate`** - WebRTC连接候选
- **`userStreamReady`** - 用户媒体流准备就绪
- **`start-call`** - 开始通话
- **`end-call`** - 结束通话
- **`disconnect`** - 用户断开连接

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 💻 开发指南

### 系统要求
- **Node.js** 16.0 或更高版本
- **npm** 8.0 或更高版本
- **Git** 版本控制系统

### 开发环境配置
```bash
# 克隆项目
git clone <repository-url>
cd project_cursor_chat

# 安装所有依赖
npm run install-all

# 启动开发服务器
./start.sh          # macOS/Linux
# 或者
.\start.bat         # Windows
```

### 开发流程
1. **热重载开发**: 修改代码后自动重新编译和刷新
2. **端口分配**:
   - 前端开发服务器: `http://localhost:3000`
   - 后端API服务: `http://localhost:3001`
   - WebSocket连接: 自动建立到后端服务
3. **实时通信**: 基于HTTP轮询的实时消息推送
4. **数据库**: 自动连接到Neon PostgreSQL云数据库

### 调试工具
- **浏览器开发者工具**: React DevTools扩展
- **服务器日志**: 控制台输出详细的连接和错误信息
- **数据库调试**: `/api/test-db` 端点查看数据库状态
- **健康检查**: `/health` 端点监控服务器状态

## 🎯 核心特性详解

### 实时文本聊天
- **消息实时传输**: 基于HTTP轮询实现亚秒级消息推送
- **消息历史**: 自动保存和加载最近50条消息
- **用户状态**: 实时显示用户在线/离线状态
- **昵称管理**: 防重复昵称系统，确保用户唯一性

### 音视频通信
- **WebRTC P2P**: 点对点直接连接，降低服务器负载
- **信令服务**: Socket.io处理连接建立和媒体协商
- **媒体控制**: 摄像头和麦克风开关控制
- **视频质量**: 自适应码率，适配不同网络环境

### 响应式设计
- **多设备支持**: 从320px到4K屏幕的完美适配
- **流式布局**: 使用CSS clamp()实现尺寸自适应
- **触摸优化**: 移动端友好的交互体验
- **性能优化**: 按需加载和虚拟滚动

## 🚀 部署方案

### 生产环境部署
- **Vercel集成**: 一键部署到全球CDN
- **数据库**: Neon PostgreSQL云数据库
- **环境变量**: 安全的配置管理
- **监控**: 实时性能和错误监控

### 本地开发环境
- **热重载**: Vite提供快速开发体验
- **代理配置**: 自动处理CORS和WebSocket
- **日志系统**: 详细的调试信息输出
- **错误处理**: 完善的异常捕获和恢复

## 📊 性能优化

- **代码分割**: 路由级别的代码懒加载
- **资源压缩**: 自动压缩和优化静态资源
- **缓存策略**: 智能的浏览器缓存
- **内存管理**: 自动清理不活跃连接
- **数据库优化**: 连接池和查询优化

## 🔒 安全特性

- **输入验证**: 客户端和服务端双重验证
- **XSS防护**: 安全的HTML转义
- **CORS配置**: 严格的跨域访问控制
- **数据加密**: 敏感信息传输加密
- **SQL注入防护**: 参数化查询

## 🤝 贡献指南

1. Fork项目到你的GitHub账户
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📝 更新日志

### v1.0.0 (2025-01-XX)
- ✨ 完整的实时聊天功能
- 📹 WebRTC音视频通话
- 📱 全面的响应式设计
- 💾 PostgreSQL数据持久化
- 🚀 一键部署到Vercel

## 📄 许可证

**MIT License** - 详见 [LICENSE](LICENSE) 文件

---

**💡 提示**: 项目正在持续开发中，欢迎提交Issue和Pull Request来改进这个项目！


