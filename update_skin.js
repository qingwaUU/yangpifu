const axios = require('axios');
const fs = require('fs');

/**
 * 羊了个羊皮肤抓取脚本 v2
 * 
 * 数据来源：
 * 1. 皮肤列表 JSON（skinList）— 560个皮肤的基础数据（id、spSkin、platform等）
 * 2. 语言文件 JSON（language）— 4403个条目，包含3228+个皮肤名称
 * 
 * 语言文件中皮肤名称的映射规则：
 *   skin_id = lang_index - 690
 *   lang[691] = "羊了个羊" → skin_id = 1
 *   lang[692] = "卷羊" → skin_id = 2
 *   ...以此类推
 * 
 * 注意：语言文件的 UUID 会随游戏版本更新而变化。
 * 如果脚本失效，请重新抓包获取最新的 JSON 链接。
 */

// 官方资源基础路径
const BASE_URL = 'https://cat-match-static.easygame2021.com/catMatch/sheep_wx/remote/resources/import/';

// 资源链接配置（UUID 会随版本更新而变化）
const CONFIG = {
    // 语言文件 — 包含所有皮肤名称（微信版，538KB，4403个条目）
    language: '46/46b0c95d-d055-444c-b4ae-936b24d1725e.5496f.json',
    // 皮肤列表 — 基础皮肤数据（560个，含platform、spSkin等字段）
    skinList: '62/62e2f78f-fa22-4fee-8294-d16593f17957.9b407.json',
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

    // 1. 获取语言文件（皮肤名称）
    const jsonLanguage = await fetchData(CONFIG.language);
    if (!jsonLanguage) {
        console.error('语言文件获取失败，停止运行。');
        process.exit(1);
    }

    const rawLanguage = jsonLanguage[5][0][2];
    const langKeys = Object.keys(rawLanguage);
    const maxLangKey = Math.max(...langKeys.map(Number));
    console.log(`语言文件加载成功：${langKeys.length} 个条目，最大索引 ${maxLangKey}`);

    // 2. 获取皮肤列表（基础数据）
    const jsonSkinList = await fetchData(CONFIG.skinList);

    // 3. 从语言文件提取所有皮肤名称
    // 映射规则：skin_id = lang_index - 690
    // lang[691] = "羊了个羊" → skin_id = 1
    const LANG_OFFSET = 690;
    const skinNameMap = {};
    let skinCount = 0;

    for (const key of langKeys) {
        const langIdx = parseInt(key);
        if (langIdx <= LANG_OFFSET) continue;

        const skinId = langIdx - LANG_OFFSET;
        const zh = rawLanguage[langIdx] ? rawLanguage[langIdx]['zh'] : '';
        if (!zh || zh.length > 25) continue;

        // 过滤掉非皮肤条目（段位奖励、游戏圈任务、集卡等）
        if (zh.startsWith('求一张') || zh.startsWith('段位') || 
            zh.startsWith('巅峰赛') || zh.startsWith('游戏圈')) {
            continue;
        }

        skinNameMap[skinId] = zh;
        skinCount++;
    }

    console.log(`从语言文件提取到 ${skinCount} 个皮肤名称 (ID 1~${Math.max(...Object.keys(skinNameMap).map(Number))})`);

    // 4. 如果有皮肤列表数据，合并基础信息
    let skins = [];
    if (jsonSkinList) {
        const rawSkins = jsonSkinList[5][0][2];
        const platformSkins = rawSkins.filter(item => item.platform === 1);
        console.log(`皮肤列表加载成功：${platformSkins.length} 个 platform=1 皮肤`);

        // 用皮肤列表作为基础，补充语言文件中的名称
        skins = platformSkins.map(skin => {
            const skinData = { ...skin };
            // 如果皮肤列表中没有名称，从语言文件中获取
            if (!skinData.name && skinData.id && skinNameMap[skinData.id]) {
                skinData.name = skinNameMap[skinData.id];
            }
            return skinData;
        });

        // 添加语言文件中有但皮肤列表中没有的皮肤
        const existingIds = new Set(skins.map(s => s.id));
        const maxListId = Math.max(...skins.map(s => s.id), 0);
        
        for (const [idStr, name] of Object.entries(skinNameMap)) {
            const id = parseInt(idStr);
            if (!existingIds.has(id)) {
                skins.push({
                    id: id,
                    clothesId: id,
                    index: id,
                    spSkin: `skin_${String(id).padStart(2, '0')}`,
                    spGroup: 'Skin00-49',
                    isTopic: 0,
                    platform: 1,
                    desc: '',
                    channel: [],
                    name: name,
                    _fromLang: true  // 标记来源
                });
            }
        }

        // 按 id 排序
        skins.sort((a, b) => a.id - b.id);
        console.log(`合并后共 ${skins.length} 个皮肤`);
    } else {
        // 没有皮肤列表，直接用语言文件生成
        console.log('皮肤列表获取失败，仅使用语言文件数据');
        for (const [idStr, name] of Object.entries(skinNameMap)) {
            skins.push({
                id: parseInt(idStr),
                clothesId: parseInt(idStr),
                name: name,
                _fromLang: true
            });
        }
        skins.sort((a, b) => a.id - b.id);
    }

    // 5. 保存结果
    fs.writeFileSync('skins_orig.json', JSON.stringify(skins, null, 2));
    console.log(`抓取完成！共获取到 ${skins.length} 个皮肤。数据已保存至 skins_orig.json`);

    // 6. 同时保存纯名称映射（方便其他项目使用）
    const nameOnly = {};
    for (const skin of skins) {
        if (skin.name && skin.name !== '未知皮肤' && skin.name !== '未知主题') {
            nameOnly[skin.id] = skin.name;
        }
    }
    fs.writeFileSync('skin_names.json', JSON.stringify(nameOnly, null, 2));
    console.log(`皮肤名称映射已保存至 skin_names.json（${Object.keys(nameOnly).length} 个）`);
};

run();
