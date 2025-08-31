// lib/database.js - 数据库连接模块
const cloud = require('wx-server-sdk');

// 数据库连接池
let cachedDb = null;
let cloudInstance = null;

/**
 * 连接到微信云数据库
 */
export async function connectToDatabase() {
  try {
    // 如果已有缓存连接，直接返回
    if (cachedDb && cloudInstance) {
      return cachedDb;
    }

    console.log('🔌 初始化云数据库连接...');

    // 初始化云开发
    if (!cloudInstance) {
      cloud.init({
        env: process.env.WX_ENV_ID || 'education-1geprlt378fa237c', // 云环境ID
        traceUser: true,
      });
      cloudInstance = cloud;
    }

    // 获取数据库引用
    const db = cloud.database();
    
    // 测试连接
    await db.collection('books').limit(1).get();
    
    cachedDb = db;
    console.log('✅ 云数据库连接成功');
    
    return db;

  } catch (error) {
    console.error('❌ 云数据库连接失败:', error);
    throw new Error(`数据库连接失败: ${error.message}`);
  }
}

/**
 * 获取云存储实例
 */
export function getCloudStorage() {
  try {
    if (!cloudInstance) {
      cloud.init({
        env: process.env.WX_ENV_ID || 'education-1geprlt378fa237c',
        traceUser: true,
      });
      cloudInstance = cloud;
    }
    
    return cloud.storage();
  } catch (error) {
    console.error('❌ 云存储初始化失败:', error);
    throw new Error(`云存储初始化失败: ${error.message}`);
  }
}

/**
 * 获取临时文件URL
 */
export async function getTempFileURLs(fileIds) {
  try {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return {};
    }

    const storage = getCloudStorage();
    const result = await storage.getTempFileURL({
      fileList: fileIds
    });

    const urlMap = {};
    if (result.fileList) {
      result.fileList.forEach(file => {
        if (file.status === 0) {
          urlMap[file.fileID] = file.tempFileURL;
        }
      });
    }

    return urlMap;
  } catch (error) {
    console.error('❌ 获取临时文件URL失败:', error);
    return {};
  }
}

/**
 * 数据库查询辅助函数
 */
export const dbUtils = {
  
  /**
   * 分页查询
   */
  async paginate(collection, options = {}) {
    const {
      page = 1,
      limit = 20,
      orderBy = '_id',
      orderDirection = 'desc',
      where = {}
    } = options;

    const skip = (page - 1) * limit;
    
    try {
      const [dataResult, countResult] = await Promise.all([
        collection
          .where(where)
          .orderBy(orderBy, orderDirection)
          .skip(skip)
          .limit(limit)
          .get(),
        collection
          .where(where)
          .count()
      ]);

      return {
        data: dataResult.data,
        total: countResult.total,
        page,
        limit,
        totalPages: Math.ceil(countResult.total / limit),
        hasMore: page * limit < countResult.total
      };
    } catch (error) {
      console.error('分页查询失败:', error);
      throw error;
    }
  },

  /**
   * 聚合查询
   */
  async aggregate(collection, pipeline) {
    try {
      const result = await collection.aggregate(pipeline).get();
      return result.data;
    } catch (error) {
      console.error('聚合查询失败:', error);
      throw error;
    }
  },

  /**
   * 批量操作
   */
  async batchOperation(collection, operations) {
    try {
      const results = await Promise.all(operations.map(op => {
        switch (op.type) {
          case 'add':
            return collection.add({ data: op.data });
          case 'update':
            return collection.doc(op.id).update({ data: op.data });
          case 'remove':
            return collection.doc(op.id).remove();
          default:
            throw new Error(`不支持的操作类型: ${op.type}`);
        }
      }));
      
      return results;
    } catch (error) {
      console.error('批量操作失败:', error);
      throw error;
    }
  }
};

/**
 * 缓存管理
 */
export const cacheManager = {
  cache: new Map(),
  
  /**
   * 设置缓存
   */
  set(key, value, ttl = 300000) { // 默认5分钟过期
    const expireTime = Date.now() + ttl;
    this.cache.set(key, { value, expireTime });
  },
  
  /**
   * 获取缓存
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  },
  
  /**
   * 删除缓存
   */
  delete(key) {
    this.cache.delete(key);
  },
  
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }
};

/**
 * 错误处理辅助函数
 */
export function handleDatabaseError(error, operation) {
  console.error(`数据库操作失败 [${operation}]:`, error);
  
  // 根据错误类型返回不同的错误信息
  if (error.message.includes('permission')) {
    return { error: '权限不足', code: 'PERMISSION_DENIED' };
  }
  
  if (error.message.includes('network')) {
    return { error: '网络连接失败', code: 'NETWORK_ERROR' };
  }
  
  if (error.message.includes('timeout')) {
    return { error: '请求超时', code: 'TIMEOUT' };
  }
  
  return { error: '数据库操作失败', code: 'DATABASE_ERROR', details: error.message };
}

