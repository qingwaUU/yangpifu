const axios = require('axios');
const fs = require('fs');

/**
 * 羊了个羊皮肤抓取脚本
 * 功能：从官方静态资源服务器获取最新皮肤数据并解析保存
 */

// 官方资源基础路径
const BASE_URL = 'https://cat-match-static.easygame2021.com/catMatch/sheep_wx/remote/resources/import/';

// 资源链接配置（这些 UUID 和 Hash 可能会随版本更新而变化，
// 建议如果脚本失效，请重新抓包获取最新的 JSON 链接）
const CONFIG = {
    language: '46/46b0c95d-d055-444c-b4ae-936b24d1725e.3c84b.json',
    skinList: '62/62e2f78f-fa22-4fee-8294-d16593f17957.9b407.json',
    gameTopic: '10/10b93ebb-0229-4c5b-b28c-19f37ebe8bb8.78954.json',
    blockTopic: '16/16c7f440-2f64-40e1-b7e7-51d257e38e2e.049f8.json'
};

const fetchData = async (path) => {
    try {
        const response = await axios.get(BASE_URL + path);
        return response.data;
    } catch (error) {
        console.error(`获取资源失败: ${path}`, error.message);
        return null;
    }
};

const run = async () => {
    console.log('开始抓取皮肤数据...');

    const jsonLanguage = await fetchData(CONFIG.language);
    const jsonSkinList = await fetchData(CONFIG.skinList);
    const jsonGameTopic = await fetchData(CONFIG.gameTopic);
    const jsonBlockTopic = await fetchData(CONFIG.blockTopic);

    if (!jsonLanguage || !jsonSkinList) {
        console.error('关键资源获取失败，停止运行。');
        process.exit(1);
    }

    // 提取核心数据结构 (基于 Cocos Creator 导出的 JSON 格式)
    const rawSkins = jsonSkinList[5][0][2];
    const rawLanguage = jsonLanguage[5][0][2];
    
    // 过滤出有效的平台皮肤
    let skins = rawSkins.filter(item => item.platform === 1);

    // 皮肤名称映射逻辑
    let normalSkinDiff = 678;
    let topicSkinStartIdx = 0;

    skins.forEach(skin => {
        if (skin.spSkin.startsWith('skin_')) {
            // 常规皮肤
            const idNum = parseInt(skin.spSkin.split('_')[1]);
            const diff = idNum >= 80 ? 682 : 678;
            const langIdx = diff + idNum;
            skin.name = rawLanguage[langIdx] ? rawLanguage[langIdx]['zh'] : '未知皮肤';
            topicSkinStartIdx = Math.max(topicSkinStartIdx, langIdx);
        }
    });

    // 主题皮肤处理
    skins.forEach(skin => {
        if (!skin.spSkin.startsWith('skin_')) {
            skin.isTopic = 1;
            // 简单的主题皮肤名称匹配逻辑（基于原作者算法）
            const topicId = parseInt(skin.spSkin.slice(3, 5));
            const isB = skin.spSkin.endsWith('B');
            const langIdx = topicSkinStartIdx + 1 + topicId * 2 + (isB ? 1 : 0);
            skin.name = rawLanguage[langIdx] ? rawLanguage[langIdx]['zh'] : '未知主题';
        }
    });

    // 保存结果
    fs.writeFileSync('skins_orig.json', JSON.stringify(skins, null, 2));
    console.log(`抓取完成！共获取到 ${skins.length} 个皮肤。数据已保存至 skins_orig.json`);
};

run();
