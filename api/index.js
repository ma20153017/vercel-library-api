/**
 * 根路由 - API健康检查端点
 */

module.exports = function handler(req, res) {
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
    version: '2.0.0',
    database: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: {
        index: '/api',
        test: '/api/test'
      },
      books: {
        categories: '/api/books/categories',
        hot: '/api/books/hot',
        search: '/api/books/search',
        detail: '/api/books/detail'
      },
      users: {
        status: '/api/users/status',
        profile: '/api/users/profile',
        favorites: '/api/users/favorites'
      },
      borrow: {
        records: '/api/borrow/records',
        create: '/api/borrow/create',
        return: '/api/borrow/return'
      }
    },
    environment: process.env.NODE_ENV || 'development',
    features: [
      'MongoDB Atlas 数据库',
      '智能图书推荐',
      '借阅管理系统',
      '用户收藏功能',
      '图书分类浏览',
      '缓存优化'
    ],
    status: 'healthy'
  });
};