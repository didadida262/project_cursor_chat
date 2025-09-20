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
    
    // 立即初始化数据库表
    pool.on('connect', async () => {
      console.log('🔄 数据库连接建立，开始初始化表...');
      await initDatabase();
    });
    
    // 也立即尝试初始化（防止connect事件不触发）
    setTimeout(async () => {
      console.log('🔄 延迟初始化数据库表...');
      await initDatabase();
    }, 1000);
    
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
  if (!pool) {
    console.log('⚠️ 数据库连接池不存在，跳过表初始化');
    return;
  }
  
  try {
    console.log('🔄 开始初始化数据库表...');
    
    // 创建用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        nickname VARCHAR(255) NOT NULL,
        is_online BOOLEAN DEFAULT true,
        join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ users表创建成功');
    
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
    console.log('✅ messages表创建成功');
    
    console.log('✅ 数据库表初始化完成');
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error);
    console.error('错误详情:', error.message);
  }
}

// 启动时初始化数据库，延迟执行确保连接建立
setTimeout(initDatabase, 3000);

// 确保表存在的函数
async function ensureTablesExist() {
  if (!pool) {
    console.log('⚠️ 数据库连接池不存在，跳过表检查');
    return;
  }
  
  try {
    console.log('🔄 检查数据库表是否存在...');
    await initDatabase();
    console.log('✅ 数据库表检查完成');
  } catch (error) {
    console.error('❌ 检查表存在性失败:', error);
  }
}

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

// SSE客户端连接存储

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
const HEARTBEAT_TIMEOUT = 120000; // 120秒无响应视为离线（更宽松的检测）
const HEARTBEAT_CHECK_INTERVAL = 60000; // 每60秒检查一次（进一步减少检查频率）

// 心跳检测 - 自动清理离线用户（临时禁用）
// setInterval(async () => {
//   const now = Date.now();
//   const inactiveUsers = [];
//   
//   // 检查所有用户的心跳
//   for (const [userId, lastHeartbeat] of userHeartbeats.entries()) {
//     const timeSinceLastHeartbeat = now - lastHeartbeat;
//     
//     // 记录心跳状态，便于调试
//     if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT * 0.8) { // 超过80%超时时间时警告
//       const user = onlineUsers.get(userId);
//       console.log(`⚠️ 用户 ${user?.nickname || userId} 心跳延迟: ${Math.round(timeSinceLastHeartbeat/1000)}秒`);
//     }
//     
//     // 只有在确实超过超时时间时才标记为离线
//     if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
//       inactiveUsers.push(userId);
//     }
//   }
//   
//   // 清理离线用户
//   if (inactiveUsers.length > 0) {
//     console.log(`💔 检测到 ${inactiveUsers.length} 个离线用户，正在清理...`);
//     
//     for (const userId of inactiveUsers) {
//       const user = onlineUsers.get(userId);
//       if (user) {
//         const timeSinceLastHeartbeat = now - userHeartbeats.get(userId);
//         console.log(`🧹 清理离线用户: ${user.nickname} (ID: ${userId}), 最后心跳: ${Math.round(timeSinceLastHeartbeat/1000)}秒前`);
//         
//         onlineUsers.delete(userId);
//         userHeartbeats.delete(userId);
//         
//         // 同时从PostgreSQL删除
//         await removeUser(userId);
//       }
//     }
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

// 临时禁用心跳检测，测试是否是心跳检测导致用户闪动问题
console.log('⚠️ 心跳检测已临时禁用，用于调试用户闪动问题');
console.log(`💓 心跳检测配置: 超时时间=${HEARTBEAT_TIMEOUT/1000}秒, 检查间隔=${HEARTBEAT_CHECK_INTERVAL/1000}秒`);

// 定期强制清理无效用户（每30秒执行一次）
// 暂时禁用定期清理，避免误删用户
// setInterval(async () => {
//   console.log('🧹 开始定期清理无效用户...');
//   
//   // 清理内存中无效的心跳记录
//   const now = Date.now();
//   const invalidHeartbeats = [];
//   
//   for (const [userId, lastHeartbeat] of userHeartbeats.entries()) {
//     if (now - lastHeartbeat > HEARTBEAT_TIMEOUT * 2) { // 超过2倍超时时间
//       invalidHeartbeats.push(userId);
//     }
//   }
//   
//   for (const userId of invalidHeartbeats) {
//     const user = onlineUsers.get(userId);
//     if (user) {
//       onlineUsers.delete(userId);
//       userHeartbeats.delete(userId);
//       await removeUser(userId);
//       console.log(`🧹 强制清理无效用户: ${user.nickname} (ID: ${userId})`);
//     }
//   }
//   
//   if (invalidHeartbeats.length > 0) {
//     console.log(`🧹 定期清理完成，清理了 ${invalidHeartbeats.length} 个无效用户`);
//   }
// }, 30000); // 每30秒执行一次

// 消息存储相关的辅助函数
const HISTORY_LIMIT = 50;
const MAX_MESSAGES = 1000;

// 用户状态持久化函数
async function saveUser(userData) {
  try {
    console.log(`💾 [${serverInstanceId}] saveUser被调用，PostgreSQL连接状态: ${pool ? '已连接' : '未连接'}`);
    if (pool) {
      console.log(`💾 [${serverInstanceId}] 开始保存用户到PostgreSQL:`, userData);
      
      // 先确保表存在
      await ensureTablesExist();
      
      const result = await pool.query(
        `INSERT INTO users (id, nickname, is_online, join_time) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (id) 
         DO UPDATE SET 
           nickname = EXCLUDED.nickname,
           is_online = EXCLUDED.is_online,
           join_time = EXCLUDED.join_time
         RETURNING *`,
        [
          userData.id,
          userData.nickname,
          true,
          userData.joinTime || new Date()
        ]
      );
      console.log(`💾 [${serverInstanceId}] 用户状态已保存到PostgreSQL: ${userData.nickname}`, result.rows[0]);
    } else {
      console.log(`💾 [${serverInstanceId}] PostgreSQL未连接，跳过保存用户状态`);
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 保存用户状态到PostgreSQL失败:`, error);
    // 如果表不存在，尝试创建表
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log(`🔄 [${serverInstanceId}] 检测到表不存在，尝试创建表...`);
      await initDatabase();
    }
  }
}

// 删除用户函数
async function removeUser(userId) {
  try {
    console.log(`🗑️ [${serverInstanceId}] removeUser被调用，删除用户ID: ${userId}`);
    if (pool) {
      console.log(`🗑️ [${serverInstanceId}] 开始从PostgreSQL删除用户: ${userId}`);
      
      const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      console.log(`🗑️ [${serverInstanceId}] 用户删除结果: ${result.rowCount} 行被删除`);
    } else {
      console.log(`🗑️ [${serverInstanceId}] PostgreSQL未连接，跳过删除用户`);
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 删除用户失败:`, error);
  }
}

// 保存消息函数
async function saveMessage(messageData) {
  try {
    console.log(`💾 [${serverInstanceId}] saveMessage被调用，保存消息: ${messageData.nickname}: ${messageData.message}`);
    if (pool) {
      console.log(`💾 [${serverInstanceId}] 开始保存消息到PostgreSQL:`, messageData);
      
      // 先确保表存在
      await ensureTablesExist();
      
      const result = await pool.query(
        `INSERT INTO messages (id, user_id, nickname, message, timestamp) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          messageData.id,
          messageData.userId,
          messageData.nickname,
          messageData.message,
          messageData.timestamp || new Date()
        ]
      );
      console.log(`💾 [${serverInstanceId}] 消息已保存到PostgreSQL: ${messageData.nickname}`, result.rows[0]);
    } else {
      console.log(`💾 [${serverInstanceId}] PostgreSQL未连接，跳过保存消息`);
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 保存消息到PostgreSQL失败:`, error);
    // 如果表不存在，尝试创建表
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log(`🔄 [${serverInstanceId}] 检测到表不存在，尝试创建表...`);
      await initDatabase();
    }
  }
}

// 更新用户心跳函数

// 获取消息函数
async function getMessages() {
  try {
    console.log(`📨 [${serverInstanceId}] getMessages被调用，PostgreSQL连接状态: ${pool ? '已连接' : '未连接'}`);
    if (pool) {
      console.log(`📨 [${serverInstanceId}] 开始从PostgreSQL获取消息`);
      
      const result = await pool.query(
        'SELECT * FROM messages ORDER BY timestamp ASC LIMIT 50'
      );
      
      const messages = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        nickname: row.nickname,
        message: row.message,
        timestamp: row.timestamp
      }));
      
      console.log(`📨 [${serverInstanceId}] 从数据库获取到 ${messages.length} 条消息`);
      return messages;
    } else {
      console.log(`📨 [${serverInstanceId}] PostgreSQL未连接，返回空消息列表`);
      return [];
    }
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 获取消息失败:`, error);
    return [];
  }
}


async function getAllOnlineUsers() {
  try {
    console.log(`💾 [${serverInstanceId}] getAllOnlineUsers被调用，PostgreSQL连接状态: ${pool ? '已连接' : '未连接'}`);
    
    // 本地开发时直接返回内存中的用户列表
    if (!pool) {
      const memoryUsers = Array.from(onlineUsers.values());
      console.log(`💾 [${serverInstanceId}] 本地开发，从内存获取在线用户: ${memoryUsers.length} 人`, memoryUsers.map(u => u.nickname));
      return memoryUsers;
    }
    
    console.log(`💾 [${serverInstanceId}] 生产环境，从PostgreSQL查询在线用户...`);
    
    // 先确保表存在
    await ensureTablesExist();
    
    const result = await pool.query('SELECT * FROM users WHERE is_online = true ORDER BY join_time ASC');
    const dbUsers = result.rows.map(row => ({
      id: row.id,
      nickname: row.nickname,
      isOnline: row.is_online,
      joinTime: row.join_time
    }));
    
    console.log(`💾 [${serverInstanceId}] 从PostgreSQL加载在线用户: ${dbUsers.length} 人`, dbUsers.map(u => u.nickname));
    
    // ⚠️ 注意：不清理PostgreSQL中的用户，因为Vercel serverless实例之间内存不共享
    // 每个实例的onlineUsers都是独立的，不能基于内存状态删除数据库用户
    console.log(`⚠️ [${serverInstanceId}] 跳过清理逻辑，避免在serverless环境中误删用户`);
    
    return dbUsers;
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 获取在线用户失败:`, error);
    // 出错时返回内存中的用户列表
    const memoryUsers = Array.from(onlineUsers.values());
    console.log(`💾 [${serverInstanceId}] 降级到内存用户列表: ${memoryUsers.length} 人`);
    return memoryUsers;
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
    
    // 检查数据库中的用户数量
    let dbUserCount = 0;
    if (pool) {
      try {
        const result = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_online = true');
        dbUserCount = parseInt(result.rows[0].count);
      } catch (error) {
        console.error('获取数据库用户数量失败:', error);
      }
    }
    
    res.json({ 
      status: 'ok',
      message: 'Chatroom Server is running',
      memory: {
        onlineUsers: onlineUsers.size,
        userHeartbeats: userHeartbeats.size
      },
      totalMessages: messageCount,
      storage: storageType,
      timestamp: new Date().toISOString(),
      serverUptime: process.uptime(),
      database: {
        ...dbStatus,
        onlineUsers: dbUserCount,
        connectionString: DATABASE_URL ? 'SET' : 'NOT_SET'
      },
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

// 检查昵称是否已存在 - 完全基于数据库
app.post('/api/check-nickname', async (req, res) => {
  try {
    const { nickname } = req.body;
    
    if (!nickname || !nickname.trim()) {
      return res.json({ 
        exists: false, 
        error: '昵称不能为空' 
      });
    }
    
    const trimmedNickname = nickname.trim();
    
    if (!pool) {
      return res.json({ 
        exists: false, 
        error: '数据库未连接，无法检查昵称' 
      });
    }
    
    // 只检查数据库中的用户
    const dbResult = await pool.query('SELECT id, nickname FROM users WHERE is_online = true AND LOWER(nickname) = LOWER($1)', [trimmedNickname]);
    
    if (dbResult.rows.length > 0) {
      const existingUser = dbResult.rows[0];
      console.log(`⚠️ [${serverInstanceId}] 昵称已存在: ${trimmedNickname} (用户ID: ${existingUser.id})`);
      return res.json({ 
        exists: true, 
        message: `昵称"${trimmedNickname}"已被使用，请选择其他昵称` 
      });
    }
    
    console.log(`✅ [${serverInstanceId}] 昵称可用: ${trimmedNickname}`);
    res.json({ 
      exists: false, 
      message: '昵称可用' 
    });
    
  } catch (error) {
    console.error('❌ 检查昵称失败:', error);
    res.status(500).json({ 
      exists: false, 
      error: '检查昵称时发生错误' 
    });
  }
});

// 测试数据库连接和表状态
app.get('/api/test-db', async (req, res) => {
  try {
    console.log(`🔍 [${serverInstanceId}] 测试数据库连接...`);
    
    if (!pool) {
      return res.json({ 
        success: false, 
        error: '数据库连接池不存在',
        pool: null 
      });
    }
    
    // 测试连接
    const client = await pool.connect();
    console.log(`✅ [${serverInstanceId}] 数据库连接测试成功`);
    
    // 检查表是否存在
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'messages')
    `);
    
    // 检查用户表数据
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
    const messagesResult = await client.query('SELECT COUNT(*) as count FROM messages');
    
    // 获取所有用户详情
    const allUsersResult = await client.query('SELECT id, nickname, is_online, join_time FROM users ORDER BY join_time ASC');
    const allUsers = allUsersResult.rows;
    console.log(`👥 [${serverInstanceId}] 数据库中的所有用户:`, allUsers);
    
    client.release();
    
    res.json({
      success: true,
      pool: 'connected',
      tables: tablesResult.rows.map(row => row.table_name),
      usersCount: usersResult.rows[0].count,
      messagesCount: messagesResult.rows[0].count,
      allUsers: allUsers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 数据库测试失败:`, error);
    res.json({ 
      success: false, 
      error: error.message,
      pool: pool ? 'exists' : 'null'
    });
  }
});

// 检查数据库用户数据
app.get('/api/db-users', async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        error: '数据库未连接',
        memoryUsers: Array.from(onlineUsers.values())
      });
    }
    
    // 获取数据库中的所有用户
    const result = await pool.query('SELECT * FROM users ORDER BY join_time DESC');
    const dbUsers = result.rows;
    
    // 获取内存中的用户
    const memoryUsers = Array.from(onlineUsers.values());
    
    res.json({
      database: {
        total: dbUsers.length,
        online: dbUsers.filter(u => u.is_online).length,
        users: dbUsers
      },
      memory: {
        total: memoryUsers.length,
        users: memoryUsers
      }
    });
  } catch (error) {
    console.error('获取数据库用户失败:', error);
    res.status(500).json({
      error: error.message,
      memoryUsers: Array.from(onlineUsers.values())
    });
  }
});

// 清理所有用户（用于测试）
app.post('/api/clear-users', async (req, res) => {
  try {
    const userCount = onlineUsers.size;
    
    // 清理内存中的用户
    onlineUsers.clear();
    userHeartbeats.clear();
    
    // 清理PostgreSQL中的用户
    if (pool) {
      await pool.query('DELETE FROM users');
      console.log(`🧹 清理了PostgreSQL中的所有用户`);
    }
    
    console.log(`🧹 清理了内存中的 ${userCount} 个用户`);
    
    res.json({ 
      success: true, 
      message: `已清理 ${userCount} 个用户（内存）和所有数据库用户`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('清理用户失败:', error);
    res.json({ 
      success: false, 
      message: `清理用户失败: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取在线用户列表 - 完全基于数据库
app.get('/api/users', async (req, res) => {
  try {
    const { exclude } = req.query; // 排除的用户ID
    console.log(`📊 [${serverInstanceId}] /api/users 请求，排除用户: ${exclude || '无'}`);
    
    if (!pool) {
      console.error(`❌ [${serverInstanceId}] 数据库未连接`);
      return res.json([]);
    }
    
    // 从数据库获取用户列表，排除指定用户
    let query = 'SELECT * FROM users WHERE is_online = true';
    let params = [];
    
    if (exclude) {
      query += ' AND id != $1';
      params.push(exclude);
    }
    
    query += ' ORDER BY join_time ASC';
    
    const dbResult = await pool.query(query, params);
    const dbUsers = dbResult.rows.map(row => ({
      id: row.id,
      nickname: row.nickname,
      isOnline: row.is_online,
      joinTime: row.join_time
    }));
    
    console.log(`📊 [${serverInstanceId}] 数据库用户数量: ${dbUsers.length} (排除: ${exclude || '无'})`);
    console.log(`📊 [${serverInstanceId}] 其他用户详情:`, dbUsers.map(u => `${u.nickname}(id:${u.id})`));
    
    res.json(dbUsers);
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 获取用户列表失败:`, error.message);
    res.json([]);
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

// 用户加入API - 完全基于数据库
app.post('/api/join', async (req, res) => {
  const userData = req.body;
  
  console.log(`🚀 [${serverInstanceId}] 用户尝试加入:`, userData);
  console.log(`📊 [${serverInstanceId}] 数据库连接状态:`, pool ? '已连接' : '未连接');
  
  if (!pool) {
    console.error(`❌ [${serverInstanceId}] 数据库未连接，无法加入`);
    return res.status(500).json({ success: false, error: '数据库未连接' });
  }
  
  try {
    // 确保表存在
    await ensureTablesExist();
    console.log(`✅ [${serverInstanceId}] 数据库表检查完成`);
    
    // 再次验证昵称是否可用（双重保险）
    const nicknameCheck = await pool.query(
      'SELECT id FROM users WHERE is_online = true AND LOWER(nickname) = LOWER($1)', 
      [userData.nickname]
    );
    
    if (nicknameCheck.rows.length > 0) {
      console.log(`⚠️ [${serverInstanceId}] 昵称已被使用: ${userData.nickname}`);
      return res.status(400).json({ 
        success: false, 
        error: `昵称"${userData.nickname}"已被使用，请选择其他昵称` 
      });
    }
    
    const user = {
      id: userData.id,
      nickname: userData.nickname,
      isOnline: true,
      joinTime: new Date().toISOString()
    };
    
    // 只有在通过昵称校验后才保存到PostgreSQL
    console.log(`💾 [${serverInstanceId}] 昵称校验通过，保存用户到PostgreSQL:`, user);
    try {
      console.log(`💾 [${serverInstanceId}] 开始调用saveUser函数...`);
      const saveResult = await saveUser(user);
      console.log(`💾 [${serverInstanceId}] saveUser函数执行完成，结果:`, saveResult);
      
      // 立即验证用户是否真的保存成功了
      console.log(`💾 [${serverInstanceId}] 开始验证用户是否保存成功...`);
      const verifyResult = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
      console.log(`💾 [${serverInstanceId}] 验证查询结果:`, verifyResult.rows);
      
      if (verifyResult.rows.length > 0) {
        console.log(`✅ [${serverInstanceId}] 用户保存验证成功:`, verifyResult.rows[0]);
      } else {
        console.error(`❌ [${serverInstanceId}] 用户保存验证失败: 数据库中找不到用户 ${user.id}`);
        
        // 额外检查：查看数据库中所有用户
        const allUsersResult = await pool.query('SELECT * FROM users');
        console.log(`🔍 [${serverInstanceId}] 数据库中所有用户:`, allUsersResult.rows);
      }
    } catch (saveError) {
      console.error(`❌ [${serverInstanceId}] saveUser函数执行失败:`, saveError);
      throw saveError; // 重新抛出错误
    }
    
    console.log(`✅ [${serverInstanceId}] 用户加入成功: ${user.nickname}`);
    
    
    res.json({ success: true, user });
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 用户加入失败:`, error);
    res.status(500).json({ success: false, error: '用户加入失败' });
  }
});

// 用户离开API - 只在关闭标签或返回输入页面时删除用户
app.post('/api/leave', async (req, res) => {
  const { userId, reason } = req.body;
  
  console.log(`👋 [${serverInstanceId}] 用户离开请求: ${userId}, 原因: ${reason || '未知'}`);
  
  if (!pool) {
    console.error(`❌ [${serverInstanceId}] 数据库未连接，无法处理离开`);
    return res.status(500).json({ success: false, error: '数据库未连接' });
  }
  
  try {
    // 只有在以下情况才删除用户：
    // 1. 关闭标签页 (reason: 'tab_close')
    // 2. 返回输入页面 (reason: 'back_to_input')
    // 3. 页面刷新 (reason: 'page_refresh')
    const validReasons = ['tab_close', 'back_to_input', 'page_refresh'];
    
    if (!reason || !validReasons.includes(reason)) {
      console.log(`⚠️ [${serverInstanceId}] 无效的离开原因，不删除用户: ${reason}`);
      return res.json({ success: true, message: '用户状态保持，未删除' });
    }
    
    // 从数据库删除用户
    await removeUser(userId);
    console.log(`✅ [${serverInstanceId}] 用户已从数据库删除: ${userId}, 原因: ${reason}`);
    
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 删除用户失败:`, error);
  }
  
  res.json({ success: true });
});

// 心跳API - 完全基于数据库

// Server-Sent Events 端点 - 用于实时推送

// 发送消息API - 完全基于数据库
app.post('/api/message', async (req, res) => {
  const messageData = req.body;
  
  console.log(`📨 [${serverInstanceId}] 收到消息: ${messageData.nickname}: ${messageData.message}`);
  console.log(`📊 [${serverInstanceId}] 发送者ID: ${messageData.userId}`);
  
  if (!pool) {
    console.error(`❌ [${serverInstanceId}] 数据库未连接，无法发送消息`);
    return res.status(500).json({ success: false, error: '数据库未连接' });
  }
  
  const message = {
    id: uuidv4(),
    userId: messageData.userId,
    nickname: messageData.nickname,
    message: messageData.message,
    timestamp: new Date().toISOString()
  };
  
  try {
    // 验证发送者是否在数据库中存在
    const result = await pool.query('SELECT id, nickname, is_online FROM users WHERE id = $1', [messageData.userId]);
    console.log(`📊 [${serverInstanceId}] 查询发送者结果:`, result.rows);
    
    const senderExists = result.rows.length > 0 && result.rows[0].is_online === true;
    console.log(`📊 [${serverInstanceId}] 发送者在数据库中: ${senderExists}`);
    
    if (!senderExists) {
      // 详细调试信息
      if (result.rows.length === 0) {
        console.error(`❌ [${serverInstanceId}] 发送者ID不存在: ${messageData.userId}`);
        // 检查数据库中所有在线用户
        const allUsers = await pool.query('SELECT id, nickname, is_online FROM users WHERE is_online = true');
        console.log(`📊 [${serverInstanceId}] 数据库中所有在线用户:`, allUsers.rows);
      } else {
        console.error(`❌ [${serverInstanceId}] 发送者存在但不在线:`, result.rows[0]);
      }
      return res.status(400).json({ success: false, error: '用户不在线' });
    }
    
    // 保存消息
    await saveMessage(message);
    
    
    // 返回成功响应
    res.json({ success: true, message });
    console.log(`✅ [${serverInstanceId}] 消息发送成功响应已发送`);
  } catch (error) {
    console.error(`❌ [${serverInstanceId}] 消息发送失败:`, error);
    res.status(500).json({ success: false, error: '消息发送失败' });
  }
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
