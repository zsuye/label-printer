// 全局变量
let labels = [];
let currentLabel = null;
let inputHistory = {};
let currentPdfPath = null;

// 保存标签 - 修复版
async function saveLabel(e) {
    if (e) {
        e.preventDefault(); // 阻止表单默认提交
        e.stopPropagation(); // 阻止事件冒泡
    }
    
    if (!currentLabel) return;
    
    try {
        // 收集表单数据
        currentLabel.labelName = document.getElementById('labelName').value;
        currentLabel.productName = document.getElementById('productName').value;
        currentLabel.ingredients = document.getElementById('ingredients').value;
        currentLabel.standardNo = document.getElementById('standardNo').value;
        currentLabel.licenseNo = document.getElementById('licenseNo').value;
        currentLabel.shelfLifeType = document.getElementById('shelfLifeType').value;
        currentLabel.normalDays = document.getElementById('normalDays').value;
        currentLabel.frozenDays = document.getElementById('frozenDays').value;
        currentLabel.netContent = document.getElementById('netContent').value;
        currentLabel.boxSpec = document.getElementById('boxSpec').value;
        currentLabel.origin = document.getElementById('origin').value;
        currentLabel.usage = document.getElementById('usage').value;
        currentLabel.manufacturer = document.getElementById('manufacturer').value;
        currentLabel.phone = document.getElementById('phone').value;
        currentLabel.address = document.getElementById('address').value;
        currentLabel.allergen = document.getElementById('allergen').value;
        currentLabel.tips = document.getElementById('tips').value;
        currentLabel.extraFields = getExtraFields();
        currentLabel.cornerTag = document.getElementById('cornerTag').value;
        
        // 更新保质期和贮存条件文本
        currentLabel.shelfLife = generateShelfLifeText(currentLabel);
        currentLabel.storageCondition = generateStorageCondition(currentLabel);
        
        // 保存到存储
        await saveLabelsToStorage();
        renderLabelList();
        
        // 保存输入历史
        await saveInputHistory();
        
        // 显示成功提示（使用非阻塞方式）
        showSuccessMessage('标签保存成功！');
        
    } catch (error) {
        console.error('保存标签时出错:', error);
        showSuccessMessage('保存失败：' + error.message);
    }
    
    // 返回false防止表单真的提交
    return false;
}

// 非阻塞的成功提示
function showSuccessMessage(message) {
    // 创建一个临时提示元素
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 3秒后自动消失
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

// 设置事件监听器 - 修复版
function setupEventListeners() {
    // 搜索
    document.getElementById('searchInput').addEventListener('input', renderLabelList);
    
    // 新增标签
    document.getElementById('addLabelBtn').addEventListener('click', createNewLabel);
    // 复制标签按钮
document.getElementById('copyLabelBtn').addEventListener('click', copyCurrentLabel);
    
    // 导入导出
    document.getElementById('importBtn').addEventListener('click', importLabels);
    document.getElementById('exportBtn').addEventListener('click', exportLabels);
    
    // 保质期类型变化
    document.getElementById('shelfLifeType').addEventListener('change', updateShelfLifeInputs);
    
    // 纸张大小变化
    document.getElementById('paperSize').addEventListener('change', (e) => {
        const customInputs = document.getElementById('customSizeInputs');
        customInputs.style.display = e.target.value === 'custom' ? 'flex' : 'none';
    });
    
    // 营养成分表上传
    document.getElementById('nutritionImage').addEventListener('change', handleImageUpload);
    
    // 表单提交 - 修复这里！！！
    const labelForm = document.getElementById('labelForm');
    // 移除旧的监听器（如果有）
    labelForm.removeEventListener('submit', saveLabel);
    // 添加新的监听器
    labelForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        saveLabel(e);
        return false;
    }, false);
    
    // 删除标签
    document.getElementById('deleteLabelBtn').addEventListener('click', deleteCurrentLabel);
    
    // 添加额外字段
    document.getElementById('addExtraFieldBtn').addEventListener('click', addExtraField);
    
    // 预览和打印
    document.getElementById('previewBtn').addEventListener('click', previewLabel);
    document.getElementById('printBtn').addEventListener('click', printLabel);
    
    // 生产日期变化时更新保质期至
    document.getElementById('productionDate').addEventListener('change', updateExpiryDate);
}

// 确保DOM加载完成后初始化 - 重要！
document.addEventListener('DOMContentLoaded', async () => {
    await loadLabels();
    await loadPrinters();
    await loadInputHistory(); // 改为await确保加载完成
    
    // 先设置基础事件监听
    setupEventListeners();
    setupFormChangeListeners();
    
    // 然后设置输入记忆（延迟一下确保DOM完全就绪）
    setTimeout(() => {
        setupInputMemory();
    }, 100);
    
    // 设置今天的日期为默认生产日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('productionDate').value = today;
    
    // 添加CSS动画
    if (!document.getElementById('toastAnimations')) {
        const style = document.createElement('style');
        style.id = 'toastAnimations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
});

// 调试函数 - 检查输入框状态
function checkInputStatus() {
    const inputs = document.querySelectorAll('input, textarea, select');
    console.log('===== 输入框状态检查 =====');
    inputs.forEach(input => {
        console.log(`${input.id || input.name || 'unnamed'}: 
            disabled=${input.disabled}, 
            readonly=${input.readOnly}, 
            type=${input.type},
            listeners=${input.onclick ? 'has-onclick' : 'no-onclick'}`);
    });
    
    // 检查是否有遮罩层
    const suggestionList = document.getElementById('suggestionList');
    console.log('建议列表状态:', suggestionList.style.display, suggestionList.style.zIndex);
}

// 在控制台可以调用这个函数来调试
window.debugInputs = checkInputStatus;

// 加载标签列表
async function loadLabels() {
    labels = await window.electronAPI.getAllLabels() || [];
    renderLabelList();
}

// 渲染标签列表
function renderLabelList() {
    const labelList = document.getElementById('labelList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // 按标签名称排序
    const sortedLabels = [...labels].sort((a, b) => 
        (a.labelName || a.productName || '').localeCompare(b.labelName || b.productName || '', 'zh-CN')
    );

    // 过滤搜索结果（同时搜索标签名称和品名）
    const filteredLabels = sortedLabels.filter(label => 
        (label.labelName || label.productName || '').toLowerCase().includes(searchTerm) ||
        (label.productName || '').toLowerCase().includes(searchTerm)
    );
    
    labelList.innerHTML = '';
    
    filteredLabels.forEach((label, index) => {
        const item = document.createElement('div');
        item.className = 'label-item';
        item.dataset.id = label.id;
        
        if (currentLabel && currentLabel.id === label.id) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
    <div class="label-item-name">${label.labelName || label.productName || '未命名标签'}</div>
    <div class="label-item-info">${label.productName || ''} | ${label.netContent || ''}</div>
`;
        
        item.addEventListener('click', () => selectLabel(label));
        labelList.appendChild(item);
    });
}

// 选择标签
function selectLabel(label) {
    currentLabel = label;
    
    // 清空之前的PDF路径，确保切换标签后重新生成PDF
    currentPdfPath = null;
    
    // 更新列表选中状态
    document.querySelectorAll('.label-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === label.id) {
            item.classList.add('active');
        }
    });
    
    // 显示编辑器视图
    document.getElementById('welcomeView').style.display = 'none';
    document.getElementById('editorView').style.display = 'flex';
    
    // 填充表单
    fillForm(label);
    
    // 加载该标签的打印设置
    loadLabelSettings(label.id);
    
    // 清空预览区域，提示用户需要重新预览
    document.getElementById('previewContent').innerHTML = '<p>标签已切换，点击预览按钮查看新标签效果</p>';
}


// 填充表单
function fillForm(label) {
  document.getElementById('labelName').value = label.labelName || '';
    document.getElementById('productName').value = label.productName || '';
    document.getElementById('ingredients').value = label.ingredients || '';
    document.getElementById('standardNo').value = label.standardNo || '';
    document.getElementById('licenseNo').value = label.licenseNo || '';
    document.getElementById('netContent').value = label.netContent || '';
    document.getElementById('boxSpec').value = label.boxSpec || '';
    document.getElementById('origin').value = label.origin || '';
    document.getElementById('usage').value = label.usage || '';
    document.getElementById('manufacturer').value = label.manufacturer || '';
    document.getElementById('phone').value = label.phone || '';
    document.getElementById('address').value = label.address || '';
    document.getElementById('allergen').value = label.allergen || '';
    document.getElementById('tips').value = label.tips || '';
    document.getElementById('cornerTag').value = label.cornerTag || '';
    
    // 保质期类型
    document.getElementById('shelfLifeType').value = label.shelfLifeType || 'normal';
    updateShelfLifeInputs();
    
    if (label.normalDays) {
        document.getElementById('normalDays').value = label.normalDays;
    }
    if (label.frozenDays) {
        document.getElementById('frozenDays').value = label.frozenDays;
    }
    
    // 营养成分表图片
    if (label.nutritionImage) {
        const preview = document.getElementById('nutritionPreview');
        preview.innerHTML = `<img src="${label.nutritionImage}" alt="营养成分表">`;
    } else {
        document.getElementById('nutritionPreview').innerHTML = '';
    }
    
    // 额外字段
    renderExtraFields(label.extraFields || []);
}

// 渲染额外字段
function renderExtraFields(fields) {
    const container = document.getElementById('extraFields');
    container.innerHTML = '';
    
    fields.forEach((field, index) => {
        const div = document.createElement('div');
        div.className = 'extra-field';
        div.innerHTML = `
            <input type="text" placeholder="字段名称" value="${field.label || ''}" data-field="label">
            <input type="text" placeholder="字段值" value="${field.value || ''}" data-field="value">
            <button type="button" class="btn btn-small" onclick="removeExtraField(${index})">删除</button>
        `;
        container.appendChild(div);
    });
}

// 添加额外字段
function addExtraField() {
    const container = document.getElementById('extraFields');
    const div = document.createElement('div');
    div.className = 'extra-field';
    div.innerHTML = `
        <input type="text" placeholder="字段名称" data-field="label">
        <input type="text" placeholder="字段值" data-field="value">
        <button type="button" class="btn btn-small" onclick="removeExtraField(this)">删除</button>
    `;
    container.appendChild(div);
}

// 删除额外字段
function removeExtraField(indexOrElement) {
    if (typeof indexOrElement === 'number') {
        renderExtraFields(getExtraFields().filter((_, i) => i !== indexOrElement));
    } else {
        indexOrElement.parentElement.remove();
    }
}

// 获取额外字段数据
function getExtraFields() {
    const fields = [];
    document.querySelectorAll('#extraFields .extra-field').forEach(field => {
        const label = field.querySelector('[data-field="label"]').value;
        const value = field.querySelector('[data-field="value"]').value;
        if (label || value) {
            fields.push({ label, value });
        }
    });
    return fields;
}



// 更新保质期输入框
function updateShelfLifeInputs() {
    const type = document.getElementById('shelfLifeType').value;
    const normalDays = document.getElementById('normalDays');
    const frozenDays = document.getElementById('frozenDays');
    
    switch(type) {
        case 'dual':
            normalDays.style.display = 'block';
            frozenDays.style.display = 'block';
            normalDays.placeholder = '常温天数';
            break;
        case 'frozen':
            normalDays.style.display = 'none';
            frozenDays.style.display = 'block';
            frozenDays.placeholder = '冷冻天数';
            break;
        default:
            normalDays.style.display = 'block';
            frozenDays.style.display = 'none';
            normalDays.placeholder = '保质天数';
    }
}

// 处理图片上传
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const preview = document.getElementById('nutritionPreview');
        preview.innerHTML = `<img src="${event.target.result}" alt="营养成分表">`;
        
        // 保存到当前标签
        if (currentLabel) {
            currentLabel.nutritionImage = event.target.result;
        }
    };
    reader.readAsDataURL(file);
}

// 创建新标签
function createNewLabel() {
    const label = {
        id: Date.now().toString(),
        productName: '新标签',
        productName: '',
        createdAt: new Date().toISOString()
    };
    
    labels.push(label);
    saveLabelsToStorage();
    renderLabelList();
    selectLabel(label);
}



// 复制当前标签
function copyCurrentLabel() {
    if (!currentLabel) {
        showSuccessMessage('请先选择一个标签');
        return;
    }
    
    // 创建新标签，复制所有属性
    const newLabel = {
        ...currentLabel, // 复制所有属性
        id: Date.now().toString(), // 新的唯一ID
        labelName: `${currentLabel.labelName || currentLabel.productName} - 副本`, // 添加副本标识
        createdAt: new Date().toISOString()
    };
    
    // 如果有营养成分表图片，也复制
    if (currentLabel.nutritionImage) {
        newLabel.nutritionImage = currentLabel.nutritionImage;
    }
    
    // 如果有额外字段，深拷贝
    if (currentLabel.extraFields) {
        newLabel.extraFields = JSON.parse(JSON.stringify(currentLabel.extraFields));
    }
    
    // 添加到标签列表
    labels.push(newLabel);
    saveLabelsToStorage();
    renderLabelList();
    
    // 选中新标签
    selectLabel(newLabel);
    
    // 显示成功提示
    showSuccessMessage('标签复制成功！请修改标签名称');
    
    // 自动聚焦到标签名称输入框，方便用户修改
    setTimeout(() => {
        document.getElementById('labelName').focus();
        document.getElementById('labelName').select();
    }, 100);
}

// 生成保质期文本 - 符合GB7718-2025标准
function generateShelfLifeText(label) {
    const type = label.shelfLifeType;
    const normal = label.normalDays;
    const frozen = label.frozenDays;
    
    switch(type) {
        case 'normalWithCold':
            return `${normal}天`;
        case 'normalWithFrozen':
            return `${normal}天`;
        case 'frozen':
            return `${frozen}天`;
        case 'dual':
            return `常温${normal}天，冷冻${frozen}天`;
        default:
            return `${normal}天`;
    }
}

// 生成贮存条件 - 符合GB7718-2025标准
function generateStorageCondition(label) {
    const type = label.shelfLifeType;
    
    switch(type) {
        case 'normalWithCold':
            return '常温贮存，开封后需冷藏';
        case 'normalWithFrozen':
            return '常温贮存，开封后需冷冻';
        case 'frozen':
            return '冷冻贮存（≤-18℃）';
        case 'dual':
            return '常温贮存或冷冻贮存（≤-18℃）';
        default:
            return '常温贮存，避免阳光直射';
    }
}

let deletedLabel = null; // 存储最近删除的标签

async function deleteCurrentLabel() {
    if (!currentLabel) return;
    
    // 保存被删除的标签
    deletedLabel = { ...currentLabel };
    const labelName = currentLabel.labelName || currentLabel.productName;
    
    labels = labels.filter(l => l.id !== currentLabel.id);
    saveLabelsToStorage();
    
    currentLabel = null;
    document.getElementById('welcomeView').style.display = 'flex';
    document.getElementById('editorView').style.display = 'none';
    
    renderLabelList();
    
    // 显示可撤销的提示
    showSuccessMessageWithUndo(`标签"${labelName}"已删除`, () => {
        // 撤销删除
        if (deletedLabel) {
            labels.push(deletedLabel);
            saveLabelsToStorage();
            renderLabelList();
            selectLabel(deletedLabel);
            showSuccessMessage('已恢复删除的标签');
            deletedLabel = null;
        }
    });
}

// 带撤销的提示消息
function showSuccessMessageWithUndo(message, undoCallback) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 15px;
    `;
    
    toast.innerHTML = `
        <span>${message}</span>
        <button style="
            background: rgba(255,255,255,0.2);
            border: 1px solid white;
            color: white;
            padding: 4px 10px;
            border-radius: 3px;
            cursor: pointer;
        ">撤销</button>
    `;
    
    const undoBtn = toast.querySelector('button');
    undoBtn.onclick = () => {
        undoCallback();
        document.body.removeChild(toast);
    };
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

// 保存标签到存储
async function saveLabelsToStorage() {
    await window.electronAPI.saveData('labels', labels);
}

// 加载打印机列表
async function loadPrinters() {
    const printers = await window.electronAPI.getPrinters();
    const select = document.getElementById('printerSelect');
    
    select.innerHTML = '<option value="">选择打印机...</option>';
    printers.forEach(printer => {
        const option = document.createElement('option');
        option.value = printer.name;
        option.textContent = printer.displayName || printer.name;
        if (printer.isDefault) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// 加载标签设置
async function loadLabelSettings(labelId) {
    const settings = await window.electronAPI.getData(`labelSettings_${labelId}`) || {};
    
    if (settings.paperSize) {
        document.getElementById('paperSize').value = settings.paperSize;
        if (settings.paperSize === 'custom') {
            document.getElementById('customSizeInputs').style.display = 'flex';
            document.getElementById('customWidth').value = settings.customWidth || '';
            document.getElementById('customHeight').value = settings.customHeight || '';
        }
    }
    
    if (settings.showProductNameOnTop !== undefined) {
        document.getElementById('showProductNameOnTop').checked = settings.showProductNameOnTop;
    }
    
    // 加载上次的生产日期
    const lastProductionDate = await window.electronAPI.getData('lastProductionDate');
    if (lastProductionDate) {
        document.getElementById('productionDate').value = lastProductionDate;
    }
}

// 保存标签设置
async function saveLabelSettings() {
    if (!currentLabel) return;
    
    const settings = {
        paperSize: document.getElementById('paperSize').value,
        customWidth: document.getElementById('customWidth').value,
        customHeight: document.getElementById('customHeight').value,
        showProductNameOnTop: document.getElementById('showProductNameOnTop').checked
    };
    
    await window.electronAPI.saveData(`labelSettings_${currentLabel.id}`, settings);
    
    // 保存生产日期
    const productionDate = document.getElementById('productionDate').value;
    if (productionDate) {
        await window.electronAPI.saveData('lastProductionDate', productionDate);
    }
}

// 更新保质期到期日 - 改进版本
function updateExpiryDate() {
    if (!currentLabel) return;
    
    const productionDate = document.getElementById('productionDate').value;
    if (!productionDate) return;
    
    const date = new Date(productionDate);
    let expiryText = '';
    
    const type = currentLabel.shelfLifeType;
    const normal = parseInt(currentLabel.normalDays);
    const frozen = parseInt(currentLabel.frozenDays);
    
    if (type === 'dual' && normal && frozen) {
        const normalExpiry = new Date(date);
        normalExpiry.setDate(normalExpiry.getDate() + normal);
        const frozenExpiry = new Date(date);
        frozenExpiry.setDate(frozenExpiry.getDate() + frozen);
        
        expiryText = `常温${formatDate(normalExpiry)}，冷冻${formatDate(frozenExpiry)}`;
    } else if (type === 'frozen' && frozen) {
        const expiry = new Date(date);
        expiry.setDate(expiry.getDate() + frozen);
        expiryText = formatDate(expiry);
    } else if (normal) {
        const expiry = new Date(date);
        expiry.setDate(expiry.getDate() + normal);
        expiryText = formatDate(expiry);
    }
    
    currentLabel.expiryDate = expiryText;
    return expiryText;
}

// 格式化日期
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
}

// 生成预览HTML - 改进版，支持自适应布局
function generatePreviewHTML(labelData, settings) {
    let html = '';
    
    // 判断纸张类型
    const isSmallPaper = settings.paperSize === '70x70mm';
    const isMediumPaper = settings.paperSize === '70x100mm';
    const isCustomSmall = settings.paperSize === 'custom' && 
                         parseFloat(settings.customWidth) < 75 && 
                         parseFloat(settings.customHeight) < 75;
    
    // 设置容器样式
    if (isSmallPaper || isCustomSmall) {
        html = '<div style="font-size:10px;line-height:1.3;">';
    } else if (isMediumPaper) {
        html = '<div style="font-size:10px;line-height:1.5;">'; // 70x100mm使用10px字体
    } else {
        html = '<div style="font-size:12px;line-height:1.6;">';
    }

    // 角标
    if (labelData.cornerTag) {
        const tagFontSize = '8px';
        html += `
            <div style="
                position: absolute;
                top: -5px;
                right: -5px;
                border: 1px solid #333;
                padding: 2px 4px;
                font-size: ${tagFontSize};
                line-height: 1.2;
                background: white;
                max-width: 50px;
                word-wrap: break-word;
                text-align: center;
                z-index: 10;
            ">${labelData.cornerTag}</div>
        `;
    }
    
    // 如果品名要独立显示在顶部
    if (settings.showProductNameOnTop && labelData.productName) {
        const titleSize = isSmallPaper || isMediumPaper ? '11px' : '16px';
        html += `<div style="text-align:center;font-size:${titleSize};font-weight:bold;margin-bottom:8px;">${labelData.productName}</div>`;
    }
    
    // 定义字段顺序
    const fields = [
        { key: 'productName', label: '品名' },
        { key: 'ingredients', label: '配料' },
        { key: 'standardNo', label: '产品标准号' },
        { key: 'licenseNo', label: '生产许可证号' },
        { key: 'shelfLife', label: '保质期' },
        { key: 'productionDate', label: '生产日期' },
        { key: 'expiryDate', label: '保质期至' },
        { key: 'storageCondition', label: '贮存条件' },
        { key: 'netContent', label: '净含量' },
        { key: 'boxSpec', label: '箱规' },
        { key: 'origin', label: '产地' },
        { key: 'usage', label: '食用方法' },
        { key: 'manufacturer', label: '生产商' },
        { key: 'phone', label: '联系电话' },
        { key: 'address', label: '地址' },
        { key: 'allergen', label: '致敏物质提示' },
        { key: 'tips', label: '温馨提示' }
    ];
    
    if (isSmallPaper || isCustomSmall) {
        // 小纸张：连续文本流布局
        html += '<div style="word-wrap:break-word;word-break:break-word;">';
        
        let fullText = '';
        const separator = '&nbsp;&nbsp;';
        
        for (const field of fields) {
            if (labelData[field.key]) {
                if (fullText) {
                    fullText += separator;
                }
                fullText += `<strong>${field.label}：</strong>${labelData[field.key]}`;
            }
        }
        
        if (labelData.extraFields && labelData.extraFields.length > 0) {
            for (const field of labelData.extraFields) {
                if (field.label && field.value) {
                    if (fullText) {
                        fullText += separator;
                    }
                    fullText += `<strong>${field.label}：</strong>${field.value}`;
                }
            }
        }
        
        html += fullText;
        html += '</div>'; 

        // 营养成分表 - 小尺寸
        if (labelData.nutritionImage) {
            html += `<div style="margin-top:8px;height:33%;max-height:33%;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                       <img src="${labelData.nutritionImage}" style="width:100%;height:100%;object-fit:contain;">
                     </div>`;
        }
    } else {
        // 中等和大纸张：传统布局（一行一个字段）
        for (const field of fields) {
            if (labelData[field.key]) {
                html += `<div><strong>${field.label}：</strong>${labelData[field.key]}</div>`;
            }
        }
        
        // 额外字段
        if (labelData.extraFields && labelData.extraFields.length > 0) {
            labelData.extraFields.forEach(field => {
                if (field.label && field.value) {
                    html += `<div><strong>${field.label}：</strong>${field.value}</div>`;
                }
            });
        }
        
        // 营养成分表
        if (labelData.nutritionImage) {
            if (isMediumPaper) {
                // 70x100mm：压缩到1/4
                html += `<div style="margin-top:8px;height:25%;max-height:25%;overflow:hidden;">
                           <img src="${labelData.nutritionImage}" style="width:100%;height:100%;object-fit:contain;">
                         </div>`;
            } else {
                // 大纸张：正常尺寸
                html += `<div style="margin-top:10px;">
                           <img src="${labelData.nutritionImage}" style="max-width:100%;">
                         </div>`;
            }
        }
    }
    
    html += '</div>';
    return html;
}

// 更新预览区域的样式以适应不同纸张
function updatePreviewAreaStyle(settings) {
    const previewContent = document.getElementById('previewContent');
    
    // 判断纸张类型
    const isSmallPaper = settings.paperSize === '70x70mm';
    const isMediumPaper = settings.paperSize === '70x100mm';
    const isCustomSmall = settings.paperSize === 'custom' && 
                         parseFloat(settings.customWidth) < 75 && 
                         parseFloat(settings.customHeight) < 75;
    
    if (isSmallPaper || isCustomSmall) {
        // 小纸张预览样式
        previewContent.style.minHeight = '300px';
        previewContent.style.maxHeight = '400px';
        previewContent.style.padding = '10px';
        previewContent.className = 'preview-content preview-content-small';
    } else if (isMediumPaper) {
        // 70x100mm预览样式
        previewContent.style.minHeight = '350px';
        previewContent.style.maxHeight = '500px';
        previewContent.style.padding = '12px';
        previewContent.className = 'preview-content preview-content-medium';
    } else {
        // 正常纸张预览样式
        previewContent.style.minHeight = '400px';
        previewContent.style.maxHeight = '600px';
        previewContent.style.padding = '15px';
        previewContent.className = 'preview-content';
    }
}

// 预览标签 - 更新版
async function previewLabel() {
    if (!currentLabel) {
        showSuccessMessage('请先选择一个标签');
        return;
    }
    
    const productionDate = document.getElementById('productionDate').value;
    if (!productionDate) {
        showSuccessMessage('请输入生产日期');
        return;
    }
    
    // 保存设置
    await saveLabelSettings();
    
    // 准备标签数据
    const labelData = {
        ...currentLabel,
        productionDate: formatDate(new Date(productionDate)),
        expiryDate: updateExpiryDate()
    };
    
    // 获取打印设置
    const settings = {
        paperSize: document.getElementById('paperSize').value,
        customWidth: document.getElementById('customWidth').value,
        customHeight: document.getElementById('customHeight').value,
        showProductNameOnTop: document.getElementById('showProductNameOnTop').checked
    };
    
    // 更新预览区域样式
    updatePreviewAreaStyle(settings);
    
    // 生成PDF
    currentPdfPath = await window.electronAPI.generatePDF(labelData, settings);
    
    // 显示预览内容
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = generatePreviewHTML(labelData, settings);
}

// 可选：也可以在表单发生变化时清空PDF缓存
function onFormDataChange() {
    // 当表单数据发生变化时，清空PDF缓存，确保下次预览/打印使用最新数据
    currentPdfPath = null;
    
    // 清空预览内容，提示用户重新预览
    const previewContent = document.getElementById('previewContent');
    if (previewContent.innerHTML !== '<p>点击预览按钮查看标签效果</p>') {
        previewContent.innerHTML = '<p>内容已修改，点击预览按钮查看最新效果</p>';
    }
}
// 可以为主要的输入框添加change监听器
function setupFormChangeListeners() {
    const mainInputs = [
        'productName', 'ingredients', 'standardNo', 'licenseNo',
        'netContent', 'boxSpec', 'origin', 'usage', 'manufacturer',
        'phone', 'address', 'allergen', 'tips', 'shelfLifeType',
        'normalDays', 'frozenDays'
    ];
    
    mainInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('change', onFormDataChange);
            element.addEventListener('input', onFormDataChange);
        }
    });
    
    // 生产日期变化时也清空PDF缓存
    document.getElementById('productionDate').addEventListener('change', onFormDataChange);
}

// 打印标签
async function printLabel() {
    if (!currentLabel) {
        showSuccessMessage('请先选择一个标签');
        return;
    }
    
    const productionDate = document.getElementById('productionDate').value;
    if (!productionDate) {
        showSuccessMessage('请输入生产日期');
        return;
    }
    
    const printer = document.getElementById('printerSelect').value;
    if (!printer) {
        showSuccessMessage('请选择打印机');
        return;
    }
    
    const copies = parseInt(document.getElementById('printCopies').value) || 1;
    
    try {
        // 禁用打印按钮，防止重复点击
        const printBtn = document.getElementById('printBtn');
        printBtn.disabled = true;
        printBtn.textContent = '打印中...';
        
        // 强制重新生成PDF，确保打印的是当前标签
        // 移除 if (!currentPdfPath) 的判断，每次都重新生成
        await previewLabel();
        
        // 打印
        const result = await window.electronAPI.printPDF(currentPdfPath, printer, copies);
        
        if (result.success) {
            showSuccessMessage(`成功发送到打印机，共${copies}份`);
        } else {
            showSuccessMessage(`打印失败：${result.error || '未知错误'}`);
        }
    } catch (error) {
        console.error('打印出错:', error);
        showSuccessMessage('打印过程中出现错误，请重试');
    } finally {
        // 恢复打印按钮
        const printBtn = document.getElementById('printBtn');
        printBtn.disabled = false;
        printBtn.textContent = '打印';
        
        // 确保建议列表被隐藏
        hideSuggestions();
        
        // 重新聚焦到当前活动元素，防止焦点丢失
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
            document.activeElement.blur();
        }
    }
}

// 导入标签
async function importLabels() {
    const imported = await window.electronAPI.importLabels();
    if (imported) {
        labels = imported;
        renderLabelList();
        showSuccessMessage('导入成功！');
    }
}

// 导出标签
async function exportLabels() {
    const success = await window.electronAPI.exportLabels();
    if (success) {
        showSuccessMessage('导出成功！');
    }
}

// 全局变量，用于控制建议列表的显示
let hideTimeout = null;
let isMouseOverSuggestions = false;

// 输入记忆功能
function setupInputMemory() {
    const inputs = document.querySelectorAll('input[type="text"], textarea');
    
    inputs.forEach(input => {
        // 获取输入历史
        input.addEventListener('focus', (e) => {
            showSuggestions(e.target);
        });
        
        // 更新输入历史 - 修改blur事件处理，增加延迟时间
        input.addEventListener('blur', (e) => {
            // 延迟执行，给点击建议项留出更多时间
            hideTimeout = setTimeout(() => {
                // 如果鼠标不在建议列表上，才隐藏
                if (!isMouseOverSuggestions) {
                    updateInputHistory(e.target.id, e.target.value);
                    hideSuggestions();
                }
            }, 800); // 增加到800ms
        });
        
        // 键盘导航
        input.addEventListener('keydown', (e) => {
            handleSuggestionNavigation(e);
        });
        
        // 添加input事件监听，实时更新建议
        input.addEventListener('input', (e) => {
            showSuggestions(e.target);
        });
    });
    
    // 全局点击事件，点击其他地方时隐藏建议列表
    document.addEventListener('click', (e) => {
        const suggestionList = document.getElementById('suggestionList');
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        const isSuggestion = e.target.classList.contains('suggestion-item');
        const isSuggestionList = e.target.id === 'suggestionList' || 
                                e.target.closest('#suggestionList');
        
        if (!isInput && !isSuggestion && !isSuggestionList) {
            clearTimeout(hideTimeout);
            hideSuggestions();
        }
    });
}

// 显示建议列表 - 改进版
function showSuggestions(input) {
    // 清除之前的隐藏定时器
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
    
    // 确保输入框没有被禁用
    if (input.disabled || input.readOnly) {
        return;
    }
    
    const fieldId = input.id;
    if (!fieldId) return;
    
    const history = inputHistory[fieldId] || [];
    const currentValue = input.value.toLowerCase();
    
    const filtered = history.filter(item => 
        item && item.toLowerCase().includes(currentValue) && item !== input.value
    );
    
    const suggestionList = document.getElementById('suggestionList');
    
    if (filtered.length === 0) {
        hideSuggestions();
        return;
    }
    
    suggestionList.innerHTML = '';
    
    // 添加鼠标事件监听
    suggestionList.addEventListener('mouseenter', () => {
        isMouseOverSuggestions = true;
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    });
    
    suggestionList.addEventListener('mouseleave', () => {
        isMouseOverSuggestions = false;
        // 鼠标离开建议列表后，延迟隐藏
        hideTimeout = setTimeout(() => {
            hideSuggestions();
        }, 300);
    });
    
    filtered.slice(0, 10).forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = item;
        div.dataset.index = index;
        
        // 使用mousedown而不是click，避免blur事件冲突
        div.addEventListener('mousedown', (e) => {
            e.preventDefault(); // 阻止默认行为，防止输入框失去焦点
            e.stopPropagation(); // 阻止事件冒泡
            input.value = item;
            hideSuggestions();
            // 触发input事件，以便其他监听器能够响应
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // 重新聚焦到输入框
            setTimeout(() => {
                input.focus();
            }, 10);
        });
        
        // 添加hover效果
        div.addEventListener('mouseenter', () => {
            // 清除之前的选中状态
            suggestionList.querySelectorAll('.suggestion-item').forEach(item => {
                item.classList.remove('selected');
            });
            div.classList.add('selected');
        });
        
        suggestionList.appendChild(div);
    });
    
    // 定位建议列表
    const rect = input.getBoundingClientRect();
    suggestionList.style.left = rect.left + 'px';
    suggestionList.style.top = (rect.bottom + 2) + 'px';
    suggestionList.style.width = rect.width + 'px';
    suggestionList.style.display = 'block';
    
    // 确保建议列表不会超出视窗
    const listRect = suggestionList.getBoundingClientRect();
    if (listRect.bottom > window.innerHeight) {
        suggestionList.style.top = (rect.top - listRect.height - 2) + 'px';
    }
    if (listRect.right > window.innerWidth) {
        suggestionList.style.left = (window.innerWidth - listRect.width - 10) + 'px';
    }
}

// 隐藏建议列表 - 改进版
function hideSuggestions() {
    const suggestionList = document.getElementById('suggestionList');
    if (suggestionList) {
        suggestionList.style.display = 'none';
        suggestionList.innerHTML = '';
        // 移除鼠标事件监听器（通过克隆节点的方式）
        const newSuggestionList = suggestionList.cloneNode(false);
        suggestionList.parentNode.replaceChild(newSuggestionList, suggestionList);
        newSuggestionList.id = 'suggestionList';
        newSuggestionList.className = 'suggestion-list';
    }
    
    // 重置状态
    isMouseOverSuggestions = false;
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
}

// 处理建议列表键盘导航 - 改进版
function handleSuggestionNavigation(e) {
    const suggestionList = document.getElementById('suggestionList');
    if (!suggestionList || suggestionList.style.display === 'none') return;
    
    const items = suggestionList.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    
    const selected = suggestionList.querySelector('.selected');
    let index = selected ? parseInt(selected.dataset.index) : -1;
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            index = (index + 1) % items.length;
            break;
        case 'ArrowUp':
            e.preventDefault();
            index = index <= 0 ? items.length - 1 : index - 1;
            break;
        case 'Enter':
            if (selected) {
                e.preventDefault();
                e.target.value = selected.textContent;
                hideSuggestions();
                // 触发input事件
                e.target.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
            break;
        case 'Escape':
            e.preventDefault();
            hideSuggestions();
            return;
        case 'Tab':
            // Tab键时隐藏建议
            hideSuggestions();
            return;
        default:
            return;
    }
    
    items.forEach(item => item.classList.remove('selected'));
    if (items[index]) {
        items[index].classList.add('selected');
        // 确保选中项可见
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

// 加载输入历史
async function loadInputHistory() {
    inputHistory = await window.electronAPI.getData('inputHistory') || {};
}

// 保存输入历史
async function saveInputHistory() {
    await window.electronAPI.saveData('inputHistory', inputHistory);
}

// 更新输入历史
function updateInputHistory(fieldId, value) {
    if (!value || !fieldId || value.trim() === '') return;
    
    if (!inputHistory[fieldId]) {
        inputHistory[fieldId] = [];
    }
    
    // 移除重复项
    inputHistory[fieldId] = inputHistory[fieldId].filter(item => item !== value);
    
    // 添加到开头
    inputHistory[fieldId].unshift(value);
    
    // 限制历史记录数量
    if (inputHistory[fieldId].length > 20) { // 增加到20条
        inputHistory[fieldId] = inputHistory[fieldId].slice(0, 20);
    }
    
    // 异步保存，避免阻塞
    setTimeout(() => {
        saveInputHistory();
    }, 100);
}