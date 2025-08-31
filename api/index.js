/**
 * 根路由 - API健康检查端点
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

  // 健康检查响应
  res.status(200).json({
    success: true,
    message: '智能图书馆API服务运行正常',
    service: 'Smart Library API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      books: {
        categories: '/api/books/categories',
        hot: '/api/books/hot'
      },
      users: {
        status: '/api/users/status'
      }
    },
    environment: process.env.NODE_ENV || 'development',
    status: 'healthy'
  });
}
