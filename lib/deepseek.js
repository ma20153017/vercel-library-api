const axios = require('axios');

/**
 * 调用DeepSeek API
 * @param {string} prompt - 提示词
 * @param {string} systemPrompt - 系统提示词
 * @returns {Promise<string>} - AI回复
 */
async function queryDeepSeek(prompt, systemPrompt) {
  try {
    // 完全仿照ai_test成功案例的调用方式
    const API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-546598dba68f4a92a2616461baf23231';
    
    const response = await axios({
      method: 'post',
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      data: {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }
    });

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      console.error('DeepSeek API返回异常:', response.data);
      throw new Error('AI服务返回异常数据');
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API错误:', error.response?.data || error.message);
    throw new Error('AI服务调用失败，请稍后再试');
  }
}

/**
 * 为图书推荐构建提示词
 * @param {string} query - 用户查询
 * @param {Array} books - 图书数据
 * @returns {string} - 系统提示词
 */
function buildRecommendationPrompt(query, books) {
  return `你是一个专业的图书馆员，为用户提供图书推荐和查询服务。
用户查询: "${query}"

请根据以下图书馆馆藏信息，推荐5-10本最符合用户需求的书籍。对于每本书，请提供简短的介绍和推荐理由。

以下是可用的图书：
${JSON.stringify(books, null, 2)}

请以JSON格式返回响应，格式如下:
{
  "summary": "对用户查询的总体回答和概述",
  "recommendations": [
    {
      "id": "书籍ID",
      "title": "书名",
      "author": "作者",
      "summary": "你生成的简短介绍和推荐理由(50-100字)"
    },
    ...
  ]
}

请确保返回的是有效的JSON格式，仅包含以上结构。`;
}

/**
 * 为图书查询构建提示词
 * @param {string} query - 用户查询
 * @param {Object} book - 图书数据
 * @returns {string} - 系统提示词
 */
function buildBookQueryPrompt(query, book) {
  return `你是一个专业的图书馆员，为用户解答关于图书的问题。
用户查询: "${query}"

以下是关于该书的基本信息:
${JSON.stringify(book, null, 2)}

请根据以上信息回答用户的问题。如果用户问的是图书具体内容，请根据你的知识提供准确的摘要和见解，不要编造不存在的情节。

请以JSON格式返回响应，格式如下:
{
  "answer": "对用户问题的详细回答",
  "book": {
    "id": "${book.id}",
    "title": "${book.title}",
    "author": "${book.author}",
    "summary": "你生成的书籍简介(100-200字)",
    "content": "你生成的精彩内容片段或亮点(如适用)"
  }
}

请确保返回的是有效的JSON格式，仅包含以上结构。`;
}

/**
 * 找出相关图书
 * @param {Array} books - 所有图书
 * @param {Object} currentBook - 当前图书
 * @returns {Array} - 相关图书列表
 */
function findRelatedBooks(books, currentBook) {
  if (!currentBook || !books || !books.length) return [];

  // 根据分类和关键词找相关书籍
  return books
    .filter(book => book.id !== currentBook.id) // 排除当前书
    .filter(book => {
      // 查找分类或关键词的交集
      const sameCategory = book.category && currentBook.category && 
        book.category.some(c => currentBook.category.includes(c));
      
      const sameKeywords = book.keywords && currentBook.keywords &&
        book.keywords.some(k => currentBook.keywords.includes(k));
      
      return sameCategory || sameKeywords;
    })
    .slice(0, 5); // 最多5本相关书
}

module.exports = {
  queryDeepSeek,
  buildRecommendationPrompt,
  buildBookQueryPrompt,
  findRelatedBooks
}; 