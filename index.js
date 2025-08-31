// 智能图书馆高性能API - v2.0
// 支持PostgreSQL数据库 + Redis缓存 + AI智能推荐

const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('ioredis');

// 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-546598dba68f4a92a2616461baf23231';
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

// 调试环境变量
console.log('🔍 环境变量检查:');
console.log('DATABASE_URL存在:', !!DATABASE_URL);
console.log('REDIS_URL存在:', !!REDIS_URL);
console.log('DEEPSEEK_API_KEY存在:', !!DEEPSEEK_API_KEY);
if (DATABASE_URL) {
  console.log('DATABASE_URL前缀:', DATABASE_URL.substring(0, 20) + '...');
}

// 数据库连接池
let dbPool = null;
let redisClient = null;

// 初始化数据库连接
function initDatabase() {
  if (!dbPool && DATABASE_URL) {
    try {
      dbPool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      console.log('✅ PostgreSQL连接池已初始化');
    } catch (error) {
      console.error('❌ PostgreSQL连接池初始化失败:', error);
    }
  } else if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL环境变量未设置！');
  }
}

// 初始化Redis连接
function initRedis() {
  if (!redisClient && REDIS_URL) {
    redisClient = new Redis(REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    console.log('✅ Redis客户端已初始化');
  }
}

// 缓存键生成
function getCacheKey(type, ...params) {
  return `library:${type}:${params.join(':')}`;
}

// 从缓存获取数据
async function getFromCache(key, defaultTTL = 300) {
  if (!redisClient) return null;
  
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis读取错误:', error.message);
    return null;
  }
}

// 设置缓存数据
async function setCache(key, data, ttl = 300) {
  if (!redisClient) return;
  
  try {
    await redisClient.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Redis写入错误:', error.message);
  }
}

/**
 * 主API处理函数
 */
module.exports = async (req, res) => {
  try {
    // 初始化连接
    initDatabase();
    initRedis();
    
    // 处理CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 路由请求
    const path = req.url.split('?')[0].split('/').filter(Boolean)[0] || 'index';
    console.log(`📥 请求: ${req.method} ${req.url} -> ${path}`);
    
    switch (path) {
      case 'index':
        return handleIndex(req, res);
      case 'test':
        return handleTest(req, res);
      case 'recommend':
        return handleRecommend(req, res);
      case 'query':
        return handleQuery(req, res);
      case 'search':
        return handleSearch(req, res);
      case 'stats':
        return handleStats(req, res);
      default:
        return res.status(404).json({ error: '未找到API端点' });
    }
  } catch (error) {
    console.error('API路由错误:', error);
    return res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * API首页信息
 */
async function handleIndex(req, res) {
  try {
    // 获取数据库统计信息
    const stats = await getDatabaseStats();
    
  return res.status(200).json({
      api: "智能图书馆高性能API",
      version: "2.1.0",
    status: "运行中",
      database: {
        connected: !!dbPool,
        totalBooks: stats.totalBooks || 0,
        languages: stats.languages || 0,
        subjects: stats.subjects || 0
      },
      cache: {
        connected: !!redisClient,
        status: redisClient ? (redisClient.status === 'ready' ? '已连接' : '连接中') : '未连接'
      },
    endpoints: [
        { path: "/", method: "GET", description: "API信息和统计" },
      { path: "/test", method: "GET,POST", description: "测试API" },
        { path: "/recommend", method: "POST", description: "AI智能图书推荐" },
        { path: "/query", method: "POST", description: "图书详情查询" },
        { path: "/search", method: "GET,POST", description: "图书搜索" },
        { path: "/stats", method: "GET", description: "数据库统计信息" }
    ],
    timestamp: new Date().toISOString()
  });
  } catch (error) {
    console.error('获取首页信息错误:', error);
    return res.status(200).json({
      api: "智能图书馆高性能API",
      version: "2.0.0",
      status: "运行中",
      error: "无法获取详细统计信息"
    });
  }
}

/**
 * 测试API
 */
async function handleTest(req, res) {
  const tests = [];
  
  // 测试数据库连接
  try {
    if (dbPool) {
      const result = await dbPool.query('SELECT COUNT(*) as count FROM books');
      tests.push({
        name: "数据库连接",
        status: "✅ 成功",
        details: `共 ${result.rows[0].count} 本图书`
      });
    } else {
      tests.push({
        name: "数据库连接",
        status: "❌ 失败",
        details: "数据库未配置"
      });
    }
  } catch (error) {
    tests.push({
      name: "数据库连接",
      status: "❌ 失败",
      details: error.message
    });
  }
  
  // 测试Redis连接
  try {
    if (redisClient) {
      await redisClient.ping();
      tests.push({
        name: "Redis缓存",
        status: "✅ 成功",
        details: "缓存服务可用"
      });
    } else {
      tests.push({
        name: "Redis缓存",
        status: "❌ 失败",
        details: "Redis未配置"
      });
    }
  } catch (error) {
    tests.push({
      name: "Redis缓存",
      status: "❌ 失败",
      details: error.message
    });
  }
  
  return res.status(200).json({
    success: true,
    message: "API测试完成",
    tests: tests,
    timestamp: new Date().toISOString()
  });
}

/**
 * 获取数据库统计信息
 */
async function getDatabaseStats() {
  const cacheKey = getCacheKey('stats', 'overview');
  
  // 尝试从缓存获取
  let stats = await getFromCache(cacheKey);
  if (stats) {
    return stats;
  }
  
  // 从数据库查询
  try {
    if (!dbPool) {
      console.error('❌ 数据库连接池未初始化，无法获取统计信息');
      return {
        totalBooks: 0,
        languages: 0,
        subjects: 0,
        error: '数据库连接失败'
      };
    }
    
    console.log('📊 正在查询数据库统计信息...');
    
    const queries = await Promise.all([
      dbPool.query('SELECT COUNT(*) as total FROM books'),
      dbPool.query('SELECT COUNT(DISTINCT language) as languages FROM books'),
      dbPool.query('SELECT COUNT(DISTINCT subject) as subjects FROM books WHERE subject != \'\''),
      dbPool.query('SELECT language, COUNT(*) as count FROM books GROUP BY language ORDER BY count DESC LIMIT 5'),
      dbPool.query('SELECT subject, COUNT(*) as count FROM books WHERE subject != \'\' GROUP BY subject ORDER BY count DESC LIMIT 10')
    ]);
    
    stats = {
      totalBooks: parseInt(queries[0].rows[0].total),
      languages: parseInt(queries[1].rows[0].languages),
      subjects: parseInt(queries[2].rows[0].subjects),
      languageDistribution: queries[3].rows,
      popularSubjects: queries[4].rows,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`📊 统计信息查询成功: ${stats.totalBooks} 本图书`);
    
    // 缓存30分钟
    await setCache(cacheKey, stats, 1800);
    return stats;
    
  } catch (error) {
    console.error('❌ 获取统计信息错误:', error);
    return {
      totalBooks: 0,
      languages: 0,
      subjects: 0,
      error: error.message
    };
  }
}

/**
 * 统计信息API
 */
async function handleStats(req, res) {
  try {
    const stats = await getDatabaseStats();
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 图书搜索API
 */
async function handleSearch(req, res) {
  try {
    const { q: query, page = 1, limit = 20, language, subject } = req.method === 'GET' ? req.query : req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供搜索关键词'
      });
    }
    
    const searchQuery = query.trim();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    
    // 构建缓存键
    const cacheKey = getCacheKey('search', searchQuery, pageNum, limitNum, language || '', subject || '');
    
    // 尝试从缓存获取
    let result = await getFromCache(cacheKey);
    if (result) {
      return res.status(200).json(result);
    }
    
    // 构建SQL查询 - 支持繁简体中文
    let sql = `
      SELECT id, title, author, publisher, subject, language, popularity, view_count
      FROM books 
      WHERE (
        title ILIKE $1 OR 
        author ILIKE $1 OR 
        subject ILIKE $1 OR
        publisher ILIKE $1 OR
        title ILIKE $3 OR 
        author ILIKE $3 OR 
        subject ILIKE $3 OR
        to_tsvector('simple', search_text) @@ plainto_tsquery('simple', $2)
      )
    `;
    
    // 创建繁简体转换（简单映射常用字）
    const simplifiedTerms = searchQuery
      .replace(/小說/g, '小说')
      .replace(/兒童/g, '儿童')
      .replace(/數學/g, '数学')
      .replace(/歷史/g, '历史')
      .replace(/編程/g, '编程')
      .replace(/電腦/g, '电脑')
      .replace(/語言/g, '语言');
    
    const params = [`%${searchQuery}%`, searchQuery, `%${simplifiedTerms}%`];
    let paramIndex = 4;
    
    // 添加语言过滤
    if (language) {
      sql += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }
    
    // 添加主题过滤
    if (subject) {
      sql += ` AND subject = $${paramIndex}`;
      params.push(subject);
      paramIndex++;
    }
    
    // 排序和分页
    sql += ` ORDER BY popularity DESC, view_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);
    
    // 执行查询
    const searchResult = await dbPool.query(sql, params);
    
    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM books 
      WHERE (
        title ILIKE $1 OR 
        author ILIKE $1 OR 
        subject ILIKE $1 OR
        publisher ILIKE $1 OR
        title ILIKE $3 OR 
        author ILIKE $3 OR 
        subject ILIKE $3 OR
        to_tsvector('simple', search_text) @@ plainto_tsquery('simple', $2)
      )
    `;
    
    const countParams = [`%${searchQuery}%`, searchQuery, `%${simplifiedTerms}%`];
    let countParamIndex = 4;
    
    if (language) {
      countSql += ` AND language = $${countParamIndex}`;
      countParams.push(language);
      countParamIndex++;
    }
    
    if (subject) {
      countSql += ` AND subject = $${countParamIndex}`;
      countParams.push(subject);
    }
    
    const countResult = await dbPool.query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    result = {
      success: true,
      data: {
        books: searchResult.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        },
        query: searchQuery,
        filters: { language, subject }
      }
    };
    
    // 缓存5分钟
    await setCache(cacheKey, result, 300);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('搜索错误:', error);
    return res.status(500).json({
      success: false,
      error: '搜索服务暂时不可用'
    });
  }
}

/**
 * AI智能推荐API
 */
async function handleRecommend(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: '只支持POST请求' });
    }

    const { query, limit = 10 } = req.body || {};
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        error: '缺少查询参数',
        summary: "请提供查询内容以获取图书推荐",
        recommendations: []
      });
    }

    const searchQuery = query.trim();
    const limitNum = Math.min(20, Math.max(1, parseInt(limit)));
    
    console.log(`🤖 AI推荐请求: ${searchQuery}`);
    
    // 缓存键
    const cacheKey = getCacheKey('recommend', searchQuery, limitNum);
    
    // 尝试从缓存获取
    let result = await getFromCache(cacheKey);
    if (result) {
      console.log('📦 从缓存返回推荐结果');
      return res.status(200).json(result);
    }
    
    // 第一步：从数据库搜索相关图书
    const candidateBooks = await searchCandidateBooks(searchQuery, limitNum * 3);
    
    if (candidateBooks.length === 0) {
      result = {
        summary: "抱歉，我们的图书馆中没有找到与您查询相关的书籍",
        recommendations: []
      };
      await setCache(cacheKey, result, 300);
      return res.status(200).json(result);
    }
    
    // 第二步：让AI分析和推荐
    const aiRecommendations = await getAIRecommendations(searchQuery, candidateBooks, limitNum);
    
    result = {
      summary: aiRecommendations.summary || `根据您的查询"${searchQuery}"，为您推荐以下图书`,
      recommendations: aiRecommendations.recommendations || candidateBooks.slice(0, limitNum).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        subject: book.subject,
        popularity: book.popularity,
        summary: `${book.subject} | ${book.publisher || '未知出版社'}`
      }))
    };
    
    // 缓存10分钟
    await setCache(cacheKey, result, 600);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('推荐服务错误:', error);
    return res.status(500).json({ 
      error: '推荐服务暂时不可用',
      summary: "抱歉，推荐服务遇到问题，请稍后重试",
      recommendations: []
    });
  }
}

/**
 * 搜索候选图书
 */
async function searchCandidateBooks(query, limit = 30) {
  try {
    if (!dbPool) {
      console.error('❌ 数据库连接池未初始化，无法搜索候选书籍');
      return [];
    }
    
    // 繁简体转换
    const simplifiedQuery = query
      .replace(/小說/g, '小说')
      .replace(/兒童/g, '儿童')
      .replace(/數學/g, '数学')
      .replace(/歷史/g, '历史')
      .replace(/編程/g, '编程')
      .replace(/電腦/g, '电脑')
      .replace(/語言/g, '语言');
      
    console.log(`🔍 搜索候选书籍: "${query}" -> "${simplifiedQuery}"`);
    
    const sql = `
      SELECT id, title, author, publisher, subject, language, popularity, view_count
      FROM books 
      WHERE (
        title ILIKE $1 OR 
        author ILIKE $1 OR 
        subject ILIKE $1 OR
        publisher ILIKE $1 OR
        title ILIKE $3 OR 
        author ILIKE $3 OR 
        subject ILIKE $3 OR
        publisher ILIKE $3 OR
        to_tsvector('simple', search_text) @@ plainto_tsquery('simple', $2)
      )
      ORDER BY 
        CASE 
          WHEN title ILIKE $1 THEN 1
          WHEN title ILIKE $3 THEN 1
          WHEN author ILIKE $1 THEN 2
          WHEN author ILIKE $3 THEN 2
          WHEN subject ILIKE $1 THEN 3
          WHEN subject ILIKE $3 THEN 3
          ELSE 4
        END,
        popularity DESC, 
        view_count DESC
      LIMIT $4
    `;
    
    const result = await dbPool.query(sql, [`%${query}%`, query, `%${simplifiedQuery}%`, limit]);
    return result.rows;
    
  } catch (error) {
    console.error('搜索候选图书错误:', error);
    return [];
  }
}

/**
 * 获取AI推荐
 */
async function getAIRecommendations(userQuery, candidateBooks, limit = 10) {
  try {
    // 构建候选图书列表给AI参考
    const bookList = candidateBooks.slice(0, 20).map((book, index) => 
      `${index + 1}. ID:${book.id} 《${book.title}》 作者:${book.author} 分类:${book.subject} 热度:${book.popularity}`
    ).join('\n');
    
    const systemPrompt = `你是一位专业的图书馆员，根据用户查询和图书馆的真实藏书为用户推荐最合适的图书。

用户查询：${userQuery}

图书馆当前相关藏书：
${bookList}

请根据用户的查询意图，从上述真实藏书中选择最合适的${limit}本书推荐给用户。

要求：
1. 只能推荐上述列表中的图书，使用真实的ID
2. 根据相关性和质量排序
3. 为每本书提供推荐理由
4. 提供整体的推荐总结

请以JSON格式返回：
{
  "summary": "针对用户查询的总体推荐说明",
  "recommendations": [
    {
      "id": "真实的图书ID",
      "title": "图书标题",
      "author": "作者",
      "subject": "分类",
      "reason": "推荐理由(30-50字)"
    }
  ]
}`;

      const response = await axios({
        method: 'post',
        url: 'https://api.deepseek.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        data: {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
          { role: "user", content: `请为查询"${userQuery}"推荐图书` }
          ],
          temperature: 0.7,
        max_tokens: 1500
      },
      timeout: 30000
    });
    
    if (response.data?.choices?.[0]?.message?.content) {
      try {
        const aiResult = JSON.parse(response.data.choices[0].message.content);
        
        // 验证推荐的图书ID是否在候选列表中
        const validRecommendations = aiResult.recommendations?.filter(rec => {
          return candidateBooks.some(book => book.id === rec.id);
        }) || [];
        
        return {
          summary: aiResult.summary || `为您推荐以下与"${userQuery}"相关的图书`,
          recommendations: validRecommendations.slice(0, limit)
        };
        
      } catch (parseError) {
        console.error('AI响应解析错误:', parseError);
      }
    }
    
    // AI失败时返回默认推荐
    return {
      summary: `根据您的查询"${userQuery}"，为您推荐以下相关图书`,
      recommendations: candidateBooks.slice(0, limit).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        subject: book.subject,
        reason: `${book.subject}类热门图书，适合您的需求`
      }))
    };
    
  } catch (error) {
    console.error('AI推荐错误:', error);
    return {
      summary: `为您推荐以下图书`,
      recommendations: candidateBooks.slice(0, limit).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        subject: book.subject,
        reason: `热门推荐图书`
      }))
    };
  }
}

/**
 * 图书详情查询API
 */
async function handleQuery(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: '只支持POST请求',
        answer: "请使用POST方法发送请求",
        book: null
      });
    }

    const { bookId, query: userQuestion, bookTitle } = req.body || {};
    
    if (!bookId && !bookTitle) {
      return res.status(400).json({ 
        error: '缺少参数',
        answer: "请提供图书ID或书名",
        book: null
      });
    }

    console.log(`📖 图书查询: ID=${bookId}, 标题=${bookTitle}, 问题=${userQuestion}`);
    
    // 根据ID或标题查找图书
    let book = null;
    
    if (bookId) {
      // 通过ID查询
      const cacheKey = getCacheKey('book', bookId);
      book = await getFromCache(cacheKey);
      
      if (!book && dbPool) {
        const result = await dbPool.query('SELECT * FROM books WHERE id = $1', [bookId]);
        if (result.rows.length > 0) {
          book = result.rows[0];
          await setCache(cacheKey, book, 3600); // 缓存1小时
        }
      }
    } else if (bookTitle) {
      // 通过标题查询
      const cacheKey = getCacheKey('book_title', bookTitle);
      book = await getFromCache(cacheKey);
      
      if (!book && dbPool) {
        const result = await dbPool.query('SELECT * FROM books WHERE title ILIKE $1 LIMIT 1', [`%${bookTitle}%`]);
        if (result.rows.length > 0) {
          book = result.rows[0];
          await setCache(cacheKey, book, 3600);
        }
      }
    }
    
    if (!book) {
      return res.status(404).json({
        error: '图书未找到',
        answer: "抱歉，没有找到您查询的图书",
        book: null
      });
    }
    
    // 增加访问计数
    if (dbPool) {
      dbPool.query('UPDATE books SET view_count = view_count + 1 WHERE id = $1', [book.id])
        .catch(err => console.error('更新访问计数错误:', err));
    }
    
    // 如果有具体问题，使用AI回答
    let answer = `这是关于《${book.title}》的信息`;
    
    if (userQuestion && userQuestion.trim()) {
      try {
        const aiAnswer = await getAIBookAnswer(book, userQuestion);
        answer = aiAnswer || answer;
      } catch (error) {
        console.error('AI回答错误:', error);
      }
    }
    
    // 构建返回结果
    const result = {
      success: true,
      answer: answer,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        subject: book.subject,
        language: book.language,
        callno: book.callno,
        popularity: book.popularity,
        viewCount: book.view_count,
        status: book.status,
        summary: `${book.subject}类图书，由${book.publisher || '未知出版社'}出版`,
        lastViewed: new Date().toISOString()
      }
    };
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('图书查询错误:', error);
    return res.status(500).json({
      error: '查询服务不可用',
      answer: "抱歉，查询服务遇到问题，请稍后重试",
      book: null
    });
  }
}

/**
 * 获取AI对图书问题的回答
 */
async function getAIBookAnswer(book, question) {
  try {
    const systemPrompt = `你是一位专业的图书馆员，为用户解答关于特定图书的问题。

图书信息：
- 标题：${book.title}
- 作者：${book.author}
- 出版社：${book.publisher || '未知'}
- 分类：${book.subject}
- 语言：${book.language}
- 热度：${book.popularity}

请根据这本书的信息，专业地回答用户的问题。如果无法确定答案，请诚实说明。回答要简洁明了，一般控制在100-200字内。`;

      const response = await axios({
        method: 'post',
        url: 'https://api.deepseek.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        data: {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
          { role: "user", content: question }
          ],
          temperature: 0.7,
        max_tokens: 500
      },
      timeout: 20000
    });
    
    return response.data?.choices?.[0]?.message?.content || null;
    
  } catch (error) {
    console.error('AI回答错误:', error);
    return null;
  }
} 