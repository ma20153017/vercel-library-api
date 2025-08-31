/**
 * 测试端点 - 验证API是否正常工作
 */

export default function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { query } = req;
  
  res.status(200).json({
    success: true,
    message: '🎉 API测试成功！智能图书馆API正在运行',
    method: req.method,
    query: query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'host': req.headers.host
    },
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      WX_ENV_ID: process.env.WX_ENV_ID ? '已配置' : '未配置'
    },
    testResults: {
      api: '✅ API服务正常',
      cors: '✅ CORS配置正确',
      vercel: '✅ Vercel部署成功',
      env: process.env.WX_ENV_ID ? '✅ 环境变量已配置' : '⚠️ 环境变量未配置'
    }
  });
}
