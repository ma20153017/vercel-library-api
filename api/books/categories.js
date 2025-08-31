// api/books/categories.js - 获取图书分类接口
const { getCollection, handleDatabaseError, cacheManager } = require('../../lib/database');

module.exports = async function handler(req, res) {
  try {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: '只支持GET请求'
      });
    }

    console.log('🔍 开始获取图书分类数据...');

    // 检查缓存
    const cacheKey = 'book_categories';
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ 从缓存获取分类数据');
      return res.status(200).json({
        success: true,
        data: cachedData,
        total: cachedData.length,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // 获取books集合
    const booksCollection = await getCollection('books');

    // 从books集合中聚合分类数据
    const categoriesResult = await booksCollection
      .aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            subcategories: { $addToSet: "$subcategory" }
          }
        },
        {
          $project: {
            _id: 0,
            id: { $toLower: "$_id" },
            name: "$_id", 
            count: 1,
            subcategories: {
              $filter: {
                input: "$subcategories",
                cond: { $ne: ["$$this", null] }
              }
            }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
      .toArray();

    console.log('📊 分类聚合结果:', categoriesResult);

    // 处理分类数据，添加图标映射
    const iconMapping = {
      '文学': '📚',
      '科学': '🔬', 
      '技术': '💻',
      '历史': '📜',
      '艺术': '🎨',
      '教育': '🎓',
      '哲学': '🤔',
      '医学': '⚕️',
      '经济': '💰',
      '政治': '🏛️',
      '法律': '⚖️',
      '数学': '🧮',
      '物理': '⚛️',
      '化学': '🧪',
      '生物': '🧬',
      '地理': '🌍',
      '语言': '🗣️',
      '文献': '📖',
      '其他': '📋'
    };

    let categories = categoriesResult.map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: iconMapping[cat.name] || '📋',
      count: cat.count,
      subcategories: cat.subcategories || []
    }));

    // 如果没有数据，返回默认分类
    if (categories.length === 0) {
      const defaultCategories = [
        { id: 'literature', name: '文学', icon: '📚', count: 0, subcategories: [] },
        { id: 'science', name: '科学', icon: '🔬', count: 0, subcategories: [] },
        { id: 'technology', name: '技术', icon: '💻', count: 0, subcategories: [] },
        { id: 'history', name: '历史', icon: '📜', count: 0, subcategories: [] },
        { id: 'art', name: '艺术', icon: '🎨', count: 0, subcategories: [] },
        { id: 'education', name: '教育', icon: '🎓', count: 0, subcategories: [] }
      ];
      
      categories = defaultCategories;
      console.log('📝 使用默认分类数据');
    }

    // 缓存结果（5分钟）
    cacheManager.set(cacheKey, categories, 300000);

    console.log(`✅ 成功获取 ${categories.length} 个图书分类`);

    return res.status(200).json({
      success: true,
      data: categories,
      total: categories.length,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取图书分类失败:', error);
    
    const errorResponse = handleDatabaseError(error, '获取图书分类');
    
    return res.status(500).json({
      success: false,
      error: errorResponse.error,
      code: errorResponse.code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};