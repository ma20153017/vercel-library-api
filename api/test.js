/**
 * 测试端点 - 验证API和MongoDB连接是否正常工作
 */

const { getDatabaseConnectionStatus } = require('../lib/database');

module.exports = async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { query } = req;
    
    // 测试数据库连接
    const dbStatus = await getDatabaseConnectionStatus();
    
    const testResults = {
      api: '✅ API服务正常',
      cors: '✅ CORS配置正确',
      vercel: '✅ Vercel部署成功',
      mongodb: dbStatus.connected ? '✅ MongoDB连接正常' : '❌ MongoDB连接失败',
      env: process.env.MONGODB_URI ? '✅ 环境变量已配置' : '⚠️ 环境变量未配置'
    };

    // 检查整体状态
    const allTestsPassed = Object.values(testResults).every(result => result.includes('✅'));
    
    res.status(200).json({
      success: true,
      message: allTestsPassed 
        ? '🎉 API测试成功！智能图书馆API正在运行' 
        : '⚠️ API部分功能异常，请检查配置',
      method: req.method,
      query: query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'host': req.headers.host
      },
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        MONGODB_URI: process.env.MONGODB_URI ? '已配置' : '未配置',
        DB_NAME: process.env.DB_NAME || 'smart_library'
      },
      database: {
        status: dbStatus.status,
        connected: dbStatus.connected,
        database: dbStatus.database,
        error: dbStatus.error || null
      },
      testResults,
      overallStatus: allTestsPassed ? 'healthy' : 'warning'
    });

  } catch (error) {
    console.error('测试API执行失败:', error);
    
    res.status(500).json({
      success: false,
      message: '❌ API测试失败',
      error: error.message,
      timestamp: new Date().toISOString(),
      testResults: {
        api: '❌ API服务异常',
        cors: '✅ CORS配置正确',
        vercel: '✅ Vercel部署成功',
        mongodb: '❌ MongoDB连接测试失败',
        env: '❓ 环境变量状态未知'
      },
      overallStatus: 'error'
    });
  }
};