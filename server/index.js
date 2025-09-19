import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const server = createServer(app);

// PostgreSQL (Neon) 连接
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

console.log(`🔍 PostgreSQL URI检查: ${DATABASE_URL ? '已设置' : '未设置'}`);
console.log(`🔍 环境变量DATABASE_URL: ${process.env.DATABASE_URL ? '已设置' : '未设置'}`);
console.log(`🔍 环境变量POSTGRES_URL: ${process.env.POSTGRES_URL ? '已设置' : '未设置'}`);

// 创建数据库连接池
let pool = null;
if (DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    console.log('✅ PostgreSQL连接池创建成功');
  } catch (error) {
    console.error('❌ PostgreSQL连接池创建失败:', error);
    console.log('⚠️ Server will continue without PostgreSQL (using memory storage)');
  }
} else {
  console.log('⚠️ No PostgreSQL URI provided, using memory storage');
  console.log('⚠️ 请检查Vercel环境变量中的DATABASE_URL设置');
}

// 初始化数据库表
async function initDatabase() {
  if (!pool) return;
  
  try {
    // 创建消息表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        nickname VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        nickname VARCHAR(255) NOT NULL,
        is_online BOOLEAN DEFAULT true,
        join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ 数据库表初始化完成');
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error);
  }
}

// 启动时初始化数据库
initDatabase();

// 内存存储作为备用方案
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? "*" : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// 中间件
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? "*" : "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// 存储在线用户
const onlineUsers = new Map();

// 用户心跳检测 - 记录用户最后活跃时间
const userHeartbeats = new Map();

// 添加服务器实例ID，用于调试Vercel冷启动问题
const serverInstanceId = `server_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
console.log(`🆔 服务器实例启动: ${serverInstanceId}`);

// 服务器启动时从PostgreSQL恢复用户状态
async function restoreUsersFromDB() {
  try {
    if (pool) {
      const dbUsers = await getAllOnlineUsers();
      console.log(`🔄 [${serverInstanceId}] 从PostgreSQL恢复用户状态: ${dbUsers.length} 人`);
      
      // 将PostgreSQL中的用户恢复到内存
      for (const user of dbUsers) {
        onlineUsers.set(user.id, user);
        userHeartbeats.set(user.id, user.lastHeartbeat || Date.now());
      }
      
      console.log(`✅ [${serverInstanceId}] 用户状态恢复完成，内存中有 ${onlineUsers.size} 个用户`);
    } else {
      console.log(`⚠️ [${serverInstanceId}] PostgreSQL未连接，跳过用户状态恢复`);
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 恢复用户状态失败:`, error);
  }
}

// 延迟恢复用户状态，等待PostgreSQL连接
setTimeout(restoreUsersFromDB, 2000);

// 用户列表广播防抖
let lastUsersBroadcast = 0;
const USERS_BROADCAST_THROTTLE = 2000; // 2秒内最多广播一次

// 节流的用户列表广播函数
function broadcastUsersThrottled() {
  const now = Date.now();
  if (now - lastUsersBroadcast > USERS_BROADCAST_THROTTLE) {
    const users = Array.from(onlineUsers.values());
    io.emit('users', users);
    lastUsersBroadcast = now;
    console.log(`📤 广播用户列表，当前在线: ${users.length} 人`);
  }
}

// 内存存储作为备用方案
const memoryMessages = [];

// 心跳检测配置
const HEARTBEAT_TIMEOUT = 30000; // 30秒无响应视为离线
const HEARTBEAT_CHECK_INTERVAL = 15000; // 每15秒检查一次

// 临时禁用心跳检测，测试是否是心跳检测导致的问题
// setInterval(() => {
//   const now = Date.now();
//   const inactiveUsers = [];
//   
//   // 检查所有用户的心跳
//   for (const [userId, lastHeartbeat] of userHeartbeats.entries()) {
//     if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
//       inactiveUsers.push(userId);
//     }
//   }
//   
//   // 清理离线用户
//   if (inactiveUsers.length > 0) {
//     console.log(`💔 检测到 ${inactiveUsers.length} 个离线用户，正在清理...`);
//     
//     inactiveUsers.forEach(userId => {
//       const user = onlineUsers.get(userId);
//       if (user) {
//         onlineUsers.delete(userId);
//         userHeartbeats.delete(userId);
//         console.log(`🧹 清理离线用户: ${user.nickname} (ID: ${userId})`);
//       }
//     });
//     
//     // 广播更新后的用户列表（节流）
//     broadcastUsersThrottled();
//   }
//   
//   // 定期记录当前状态，便于调试
//   if (onlineUsers.size > 0) {
//     console.log(`💓 心跳检测完成，当前在线: ${onlineUsers.size} 人`);
//   }
// }, HEARTBEAT_CHECK_INTERVAL);

console.log('⚠️ 心跳检测已临时禁用，用于测试');

// 消息存储相关的辅助函数
const HISTORY_LIMIT = 50;
const MAX_MESSAGES = 1000;

// 用户状态持久化函数
async function saveUser(userData) {
  try {
    console.log(`💾 [${serverInstanceId}] saveUser被调用，PostgreSQL连接状态: ${pool ? '已连接' : '未连接'}`);
    if (pool) {
      console.log(`💾 [${serverInstanceId}] 开始保存用户到PostgreSQL:`, userData);
      const result = await pool.query(
        `INSERT INTO users (id, nickname, is_online, join_time, last_heartbeat) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (id) 
         DO UPDATE SET 
           nickname = EXCLUDED.nickname,
           is_online = EXCLUDED.is_online,
           join_time = EXCLUDED.join_time,
           last_heartbeat = EXCLUDED.last_heartbeat
         RETURNING *`,
        [
          userData.id,
          userData.nickname,
          true,
          userData.joinTime || new Date(),
          new Date()
        ]
      );
      console.log(`💾 [${serverInstanceId}] 用户状态已保存到PostgreSQL: ${userData.nickname}`, result.rows[0]);
    } else {
      console.log(`💾 [${serverInstanceId}] PostgreSQL未连接，跳过保存用户状态`);
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 保存用户状态到PostgreSQL失败:`, error);
  }
}

async function removeUser(userId) {
  try {
    if (pool) {
      await pool.query(
        'UPDATE users SET is_online = false, last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
      console.log(`💾 用户状态已更新为离线: ${userId}`);
    }
  } catch (error) {
    console.error('更新用户状态到PostgreSQL失败:', error);
  }
}

async function getAllOnlineUsers() {
  try {
    console.log(`💾 [${serverInstanceId}] getAllOnlineUsers被调用，PostgreSQL连接状态: ${pool ? '已连接' : '未连接'}`);
    if (pool) {
      console.log(`💾 [${serverInstanceId}] 开始从PostgreSQL查询在线用户...`);
      const result = await pool.query('SELECT * FROM users WHERE is_online = true ORDER BY last_heartbeat DESC');
      const users = result.rows.map(row => ({
        id: row.id,
        nickname: row.nickname,
        isOnline: row.is_online,
        joinTime: row.join_time,
        lastHeartbeat: row.last_heartbeat
      }));
      console.log(`💾 [${serverInstanceId}] 从PostgreSQL加载在线用户: ${users.length} 人`, users);
      return users;
    } else {
      console.log(`💾 [${serverInstanceId}] PostgreSQL未连接，返回空用户列表`);
      return [];
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 从PostgreSQL加载用户失败:`, error);
    return [];
  }
}

async function updateUserHeartbeat(userId) {
  try {
    if (pool) {
      await pool.query(
        'UPDATE users SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    }
  } catch (error) {
    console.error('更新用户心跳失败:', error);
  }
}

// 从存储获取消息历史
async function getMessages() {
  try {
    // 尝试从 PostgreSQL 获取
    if (pool) {
      const result = await pool.query(
        'SELECT * FROM messages ORDER BY timestamp ASC LIMIT $1',
        [HISTORY_LIMIT]
      );
      const messages = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        nickname: row.nickname,
        message: row.message,
        timestamp: row.timestamp
      }));
      console.log(`从 PostgreSQL 获取了 ${messages.length} 条消息`);
      return messages;
    } else {
      // PostgreSQL 不可用，使用内存存储
      const messages = memoryMessages.slice(-HISTORY_LIMIT);
      console.log(`从内存获取了 ${messages.length} 条消息`);
      return messages;
    }
  } catch (error) {
    console.error('获取消息失败:', error);
    // 出错时返回内存存储的消息
    const messages = memoryMessages.slice(-HISTORY_LIMIT);
    console.log(`从内存获取了 ${messages.length} 条消息 (fallback)`);
    return messages;
  }
}

// 存储新消息
async function saveMessage(messageData) {
  try {
    // 先保存到内存存储
    memoryMessages.push(messageData);
    if (memoryMessages.length > MAX_MESSAGES) {
      memoryMessages.splice(0, memoryMessages.length - MAX_MESSAGES);
    }
    
    // 尝试保存到 PostgreSQL
    if (pool) {
      await pool.query(
        'INSERT INTO messages (id, user_id, nickname, message, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [
          messageData.id,
          messageData.userId,
          messageData.nickname,
          messageData.message,
          new Date(messageData.timestamp)
        ]
      );
      
      // 清理旧消息，保持数据库大小合理
      const result = await pool.query('SELECT COUNT(*) FROM messages');
      const messageCount = parseInt(result.rows[0].count);
      if (messageCount > MAX_MESSAGES) {
        const deleteCount = messageCount - MAX_MESSAGES;
        await pool.query(
          'DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY timestamp ASC LIMIT $1)',
          [deleteCount]
        );
      }
      
      console.log(`Message saved to PostgreSQL: ${messageData.nickname}: ${messageData.message}`);
    } else {
      console.log(`PostgreSQL 不可用，消息仅保存到内存: ${messageData.nickname}: ${messageData.message}`);
    }
  } catch (error) {
    console.error('Error saving message:', error);
    console.log(`Message saved to memory (fallback): ${messageData.nickname}: ${messageData.message}`);
  }
}

// 路由
app.get('/', async (req, res) => {
  try {
    let messageCount = 0;
    let storageType = 'Memory';
    
    if (pool) {
      const result = await pool.query('SELECT COUNT(*) FROM messages');
      messageCount = parseInt(result.rows[0].count);
      storageType = 'PostgreSQL (Neon)';
    } else {
      messageCount = memoryMessages.length;
      storageType = 'Memory (PostgreSQL unavailable)';
    }
    
    res.json({ 
      message: 'Chatroom Server is running',
      onlineUsers: onlineUsers.size,
      totalMessages: messageCount,
      storage: storageType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ 
      message: 'Chatroom Server is running',
      onlineUsers: onlineUsers.size,
      totalMessages: memoryMessages.length,
      storage: 'Memory (Error)',
      timestamp: new Date().toISOString()
    });
  }
});

// 健康检查端点
app.get('/health', async (req, res) => {
  try {
    const messageCount = pool 
      ? (await pool.query('SELECT COUNT(*) FROM messages')).rows[0].count 
      : memoryMessages.length;
    const storageType = pool ? 'PostgreSQL (Neon)' : 'Memory';
    
    // 检查PostgreSQL连接状态
    const dbStatus = {
      connected: pool !== null,
      type: 'PostgreSQL (Neon)',
      host: pool ? 'neon.tech' : null,
      port: pool ? 5432 : null
    };
    
    res.json({ 
      status: 'ok',
      message: 'Chatroom Server is running',
      onlineUsers: onlineUsers.size,
      totalMessages: messageCount,
      storage: storageType,
      timestamp: new Date().toISOString(),
      userHeartbeats: userHeartbeats.size,
      serverUptime: process.uptime(),
      database: dbStatus,
      serverInstanceId: serverInstanceId
    });
  } catch (error) {
    res.json({ 
      status: 'error',
      message: 'Chatroom Server is running with errors',
      onlineUsers: onlineUsers.size,
      totalMessages: memoryMessages.length,
      storage: 'Memory (Error)',
      timestamp: new Date().toISOString(),
      userHeartbeats: userHeartbeats.size,
      serverUptime: process.uptime(),
      database: {
        connected: false,
        error: error.message
      },
      serverInstanceId: serverInstanceId
    });
  }
});

// 清理所有用户（用于测试）
app.post('/api/clear-users', (req, res) => {
  const userCount = onlineUsers.size;
  onlineUsers.clear();
  console.log(`🧹 清理了 ${userCount} 个用户`);
  
  res.json({ 
    success: true, 
    message: `已清理 ${userCount} 个用户`,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', async (req, res) => {
  try {
    // 优先从PostgreSQL获取用户列表
    const dbUsers = await getAllOnlineUsers();
    
    // 同时检查内存中的用户列表（用于调试）
    const memoryUsers = Array.from(onlineUsers.values());
    
    console.log(`📊 [${serverInstanceId}] API请求用户列表`);
    console.log(`📊 [${serverInstanceId}] PostgreSQL在线用户: ${dbUsers.length} 人`);
    console.log(`📊 [${serverInstanceId}] 内存在线用户: ${memoryUsers.length} 人`);
    console.log(`📊 [${serverInstanceId}] 用户详情:`, dbUsers.map(u => `${u.nickname}(id:${u.id})`));
    
    // 如果PostgreSQL有数据，使用PostgreSQL的数据
    if (dbUsers.length > 0) {
      console.log(`✅ [${serverInstanceId}] 使用PostgreSQL用户数据`);
      res.json(dbUsers);
    } 
    // 如果PostgreSQL没有数据，但有内存数据，同步到PostgreSQL
    else if (memoryUsers.length > 0) {
      console.log(`🔄 [${serverInstanceId}] PostgreSQL无数据，同步内存数据到PostgreSQL`);
      for (const user of memoryUsers) {
        await saveUser(user);
      }
      res.json(memoryUsers);
    }
    // 都没有数据，返回空数组
    else {
      console.log(`⚠️ [${serverInstanceId}] 无在线用户数据`);
      res.json([]);
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 获取用户列表失败:`, error);
    // 出错时回退到内存数据
    const memoryUsers = Array.from(onlineUsers.values());
    res.json(memoryUsers);
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getMessages();
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.json([]);
  }
});

// 用户加入API
app.post('/api/join', async (req, res) => {
  const userData = req.body;
  
  console.log(`🚀 [${serverInstanceId}] 用户尝试加入:`, userData);
  console.log(`📊 [${serverInstanceId}] 加入前在线用户: ${onlineUsers.size} 人`);
  console.log(`📊 [${serverInstanceId}] PostgreSQL连接状态: ${pool ? '已连接' : '未连接'}`);
  
  // 检查是否已存在相同昵称的用户
  const existingUser = Array.from(onlineUsers.values()).find(u => u.nickname === userData.nickname);
  if (existingUser) {
    // 如果存在相同昵称，更新现有用户的ID和加入时间
    onlineUsers.delete(existingUser.id);
    console.log(`🔄 更新现有用户昵称: ${userData.nickname}`);
  }
  
  const user = {
    id: userData.id,
    nickname: userData.nickname,
    isOnline: true,
    joinTime: new Date().toISOString()
  };
  
  onlineUsers.set(userData.id, user);
  userHeartbeats.set(userData.id, Date.now()); // 记录心跳时间
  
  // 同时保存到PostgreSQL
  console.log(`💾 [${serverInstanceId}] 开始保存用户到PostgreSQL:`, user);
  await saveUser(user);
  console.log(`💾 [${serverInstanceId}] 用户保存完成`);
  
  console.log(`✅ [${serverInstanceId}] 用户通过API加入: ${user.nickname} (ID: ${user.id})`);
  console.log(`👥 [${serverInstanceId}] 当前在线用户: ${onlineUsers.size} 人`);
  console.log(`📊 [${serverInstanceId}] 用户列表:`, Array.from(onlineUsers.values()).map(u => `${u.nickname}(id:${u.id})`));
  console.log(`📊 [${serverInstanceId}] onlineUsers Map内容:`, Array.from(onlineUsers.entries()));
  
  res.json({ success: true, user });
});

// 用户离开API
app.post('/api/leave', async (req, res) => {
  const { userId } = req.body;
  const user = onlineUsers.get(userId);
  
  if (user) {
    onlineUsers.delete(userId);
    userHeartbeats.delete(userId); // 清理心跳记录
    
    // 同时更新PostgreSQL状态
    await removeUser(userId);
    
    console.log(`👋 [${serverInstanceId}] 用户通过API离开: ${user.nickname}`);
  }
  
  res.json({ success: true });
});

// 心跳API
app.post('/api/heartbeat', async (req, res) => {
  const { userId } = req.body;
  
  if (userId && onlineUsers.has(userId)) {
    userHeartbeats.set(userId, Date.now());
    
    // 同时更新PostgreSQL心跳时间
    await updateUserHeartbeat(userId);
    
    console.log(`💓 [${serverInstanceId}] 收到用户心跳: ${userId}`);
  }
  
  res.json({ success: true });
});

// 发送消息API
app.post('/api/message', async (req, res) => {
  const messageData = req.body;
  const message = {
    id: uuidv4(),
    userId: messageData.userId,
    nickname: messageData.nickname,
    message: messageData.message,
    timestamp: new Date().toISOString()
  };
  
  // 保存消息
  await saveMessage(message);
  
  console.log(`📨 通过API收到消息: ${message.nickname}: ${message.message}`);
  
  // 更新发送者的心跳时间
  if (userHeartbeats.has(messageData.userId)) {
    userHeartbeats.set(messageData.userId, Date.now());
  }
  
  // 立即返回响应，不等待数据库保存完成
  res.json({ success: true, message });
  
  console.log(`✅ 消息API响应已发送`);
});

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // 设置customId为socket.id，用于WebRTC信令
  socket.customId = socket.id;

  // 用户加入聊天室
  socket.on('join', async (userData) => {
    console.log('📥 收到join事件:', userData);
    
    const user = {
      id: socket.id,
      nickname: userData.nickname,
      isOnline: true,
      joinTime: new Date().toISOString()
    };
    
    onlineUsers.set(socket.id, user);
    userHeartbeats.set(socket.id, Date.now()); // 记录心跳时间
    console.log('👥 在线用户列表更新:', Array.from(onlineUsers.values()));
    
    // 通知其他用户有新用户加入
    socket.broadcast.emit('userJoined', user);
    console.log('📢 已通知其他用户有新用户加入');
    
    // 发送当前在线用户列表
    io.emit('users', Array.from(onlineUsers.values()));
    console.log('📤 已发送用户列表给所有用户');
    
    // 发送历史消息
    try {
      const messageHistory = await getMessages();
      socket.emit('messages', messageHistory);
      console.log(`📜 已发送 ${messageHistory.length} 条历史消息给 ${user.nickname}`);
    } catch (error) {
      console.error('❌ 发送历史消息失败:', error);
      socket.emit('messages', []);
    }
    
    console.log(`✅ 用户 ${user.nickname} 成功加入聊天室`);
  });

  // 处理消息
  socket.on('message', async (messageData) => {
    const message = {
      id: uuidv4(),
      userId: messageData.userId,
      nickname: messageData.nickname,
      message: messageData.message,
      timestamp: new Date().toISOString()
    };
    
    // 先广播消息给所有用户
    io.emit('message', message);
    
    // 然后尝试保存到数据库（不阻塞消息发送）
    try {
      await saveMessage(message);
    } catch (error) {
      console.error('保存消息失败，但消息已发送:', error);
    }
    
    console.log(`Message from ${message.nickname}: ${message.message}`);
  });

  // WebRTC 信令处理
  socket.on('offer', (data) => {
    const { offer, to } = data;
    console.log(`Offer转发: ${socket.customId} -> ${to}`);
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.customId === to);
    if (targetSocket) {
      targetSocket.emit('offer', { offer, from: socket.customId });
      console.log(`Offer转发成功: ${socket.customId} -> ${to}`);
    } else {
      console.log(`Offer转发失败: 找不到目标用户 ${to}`);
      console.log('当前在线用户:', Array.from(io.sockets.sockets.values()).map(s => s.customId));
    }
  });

  socket.on('answer', (data) => {
    const { answer, to } = data;
    console.log(`Answer转发: ${socket.customId} -> ${to}`);
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.customId === to);
    if (targetSocket) {
      targetSocket.emit('answer', { answer, from: socket.customId });
      console.log(`Answer转发成功: ${socket.customId} -> ${to}`);
    } else {
      console.log(`Answer转发失败: 找不到目标用户 ${to}`);
    }
  });

  socket.on('ice-candidate', (data) => {
    const { candidate, to } = data;
    console.log(`ICE候选转发: ${socket.customId} -> ${to}`);
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.customId === to);
    if (targetSocket) {
      targetSocket.emit('ice-candidate', { candidate, from: socket.customId });
      console.log(`ICE候选转发成功: ${socket.customId} -> ${to}`);
    } else {
      console.log(`ICE候选转发失败: 找不到目标用户 ${to}`);
    }
  });

  // 处理用户流准备就绪事件
  socket.on('userStreamReady', (data) => {
    console.log(`User ${data.userId} stream ready`);
    // 广播给其他用户
    socket.broadcast.emit('userStreamReady', data);
  });

  // 视频通话控制
  socket.on('start-call', () => {
    socket.broadcast.emit('call-started');
  });

  socket.on('end-call', () => {
    socket.broadcast.emit('call-ended');
  });

  // 用户离开聊天室
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      // 通知其他用户
      socket.broadcast.emit('userLeft', user);
      
      // 从在线用户列表中移除
      onlineUsers.delete(socket.id);
      userHeartbeats.delete(socket.id); // 清理心跳记录
      
      // 更新用户列表
      io.emit('users', Array.from(onlineUsers.values()));
      
      console.log(`User ${user.nickname} left the chatroom`);
    }
    
    console.log('User disconnected:', socket.id);
  });

  // 错误处理
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// 服务器启动
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
