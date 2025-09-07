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
    
    // 按品名排序
    const sortedLabels = [...labels].sort((a, b) => 
        (a.productName || '').localeCompare(b.productName || '', 'zh-CN')
    );
    
    // 过滤搜索结果
    const filteredLabels = sortedLabels.filter(label => 
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
            <div class="label-item-name">${label.productName || '未命名标签'}</div>
            <div class="label-item-info">${label.manufacturer || ''} ${label.netContent || ''}</div>
        `;
        
        item.addEventListener('click', () => selectLabel(label));
        labelList.appendChild(item);
    });
}

// 选择标签
function selectLabel(label) {
    currentLabel = label;
    
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
    
    // 清空预览
    document.getElementById('previewContent').innerHTML = '<p>点击预览按钮查看标签效果</p>';
}

// 填充表单
function fillForm(label) {
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
        createdAt: new Date().toISOString()
    };
    
    labels.push(label);
    saveLabelsToStorage();
    renderLabelList();
    selectLabel(label);
}



// 生成保质期文本
function generateShelfLifeText(label) {
    const type = label.shelfLifeType;
    const normal = label.normalDays;
    const frozen = label.frozenDays;
    
    switch(type) {
        case 'normalWithCold':
            return `常温${normal}天，开封后需冷藏`;
        case 'normalWithFrozen':
            return `常温${normal}天，开封后需冷冻`;
        case 'frozen':
            return `冷冻${frozen}天`;
        case 'dual':
            return `常温${normal}天，冷冻${frozen}天`;
        default:
            return `${normal}天`;
    }
}

// 生成贮存条件
function generateStorageCondition(label) {
    const type = label.shelfLifeType;
    
    switch(type) {
        case 'normalWithCold':
            return '常温保存，开封后需冷藏';
        case 'normalWithFrozen':
            return '常温保存，开封后需冷冻';
        case 'frozen':
            return '冷冻保存（≤-18℃）';
        case 'dual':
            return '常温保存或冷冻保存（≤-18℃）';
        default:
            return '常温保存，避免阳光直射';
    }
}

// 删除当前标签
async function deleteCurrentLabel() {
    if (!currentLabel) return;
    
    if (!window.confirm(`确定要删除标签"${currentLabel.productName}"吗？`)) {
        return;
    }
    
    labels = labels.filter(l => l.id !== currentLabel.id);
    saveLabelsToStorage();
    
    currentLabel = null;
    document.getElementById('welcomeView').style.display = 'flex';
    document.getElementById('editorView').style.display = 'none';
    
    renderLabelList();
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

// 更新保质期至日期
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
    
    // 判断是否为小尺寸纸张
    const isSmallPaper = settings.paperSize === '70x70mm' || 
                         (settings.paperSize === 'custom' && 
                          parseFloat(settings.customWidth) < 75 && 
                          parseFloat(settings.customHeight) < 75);
    
    // 设置容器样式
    if (isSmallPaper) {
        html = '<div style="font-size:10px;line-height:1.3;">';
    } else {
        html = '<div style="font-size:12px;line-height:1.6;">';
    }
    
    // 如果品名要独立显示在顶部
    if (settings.showProductNameOnTop && labelData.productName) {
        const titleSize = isSmallPaper ? '13px' : '16px';
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
    
    if (isSmallPaper) {
        // 小纸张：紧凑布局
        let lineBuffer = [];
        const longFields = ['ingredients', 'address', 'usage', 'tips', 'allergen'];
        
        html += '<div style="word-wrap:break-word;word-break:break-all;">';
        
        for (const field of fields) {
            if (labelData[field.key]) {
                // 跳过已经在顶部显示的品名
                if (settings.showProductNameOnTop && field.key === 'productName') {
                    continue;
                }
                
                const fieldContent = `<span><strong>${field.label}：</strong>${labelData[field.key]}</span>`;
                
                // 长文本字段独占一行
                if (longFields.includes(field.key)) {
                    // 先输出缓冲区内容
                    if (lineBuffer.length > 0) {
                        html += '<div>' + lineBuffer.join('&nbsp;&nbsp;') + '</div>';
                        lineBuffer = [];
                    }
                    // 输出长文本字段
                    html += `<div>${fieldContent}</div>`;
                } else {
                    // 短字段添加到缓冲区
                    lineBuffer.push(fieldContent);
                    
                    // 每3个短字段换行（可根据实际宽度调整）
                    if (lineBuffer.length >= 2 || 
                        // 某些字段后强制换行
                        ['expiryDate', 'storageCondition', 'phone'].includes(field.key)) {
                        html += '<div>' + lineBuffer.join('&nbsp;&nbsp;') + '</div>';
                        lineBuffer = [];
                    }
                }
            }
        }
        
        // 输出剩余的缓冲区内容
        if (lineBuffer.length > 0) {
            html += '<div style="margin-bottom:2px;">' + lineBuffer.join('&nbsp;&nbsp;') + '</div>';
        }
        
        // 额外字段也采用紧凑布局（同样需要防溢出）
        if (labelData.extraFields && labelData.extraFields.length > 0) {
            lineBuffer = [];
            for (const field of labelData.extraFields) {
                if (field.label && field.value) {
                    let value = field.value;
                    // 截断超长的额外字段值
                    if (value.length > 50) {
                        value = value.substring(0, 47) + '...';
                    }
                    lineBuffer.push(`<span><strong>${field.label}：</strong>${value}</span>`);
                    if (lineBuffer.length >= 2) {
                        html += '<div style="margin-bottom:2px;">' + lineBuffer.join('&nbsp;&nbsp;') + '</div>';
                        lineBuffer = [];
                    }
                }
            }
            if (lineBuffer.length > 0) {
                html += '<div style="margin-bottom:2px;">' + lineBuffer.join('&nbsp;&nbsp;') + '</div>';
            }
        }
        
        html += '</div>';
        
        // 营养成分表 - 小尺寸，固定在底部1/3
        if (labelData.nutritionImage) {
            html += `<div style="position:relative;margin-top:5px;height:33%;max-height:120px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                       <img src="${labelData.nutritionImage}" style="width:100%;height:auto;max-height:100%;object-fit:contain;">
                     </div>`;
        }
        
    } else {
        // 大纸张：传统布局
        for (const field of fields) {
            if (labelData[field.key]) {
                if (settings.showProductNameOnTop && field.key === 'productName') {
                    continue;
                }
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
        
        // 营养成分表 - 正常尺寸
        if (labelData.nutritionImage) {
            html += `<div style="margin-top:10px;">
                       <img src="${labelData.nutritionImage}" style="max-width:100%;">
                     </div>`;
        }
    }
    
    html += '</div>';
    return html;
}

// 同时更新预览区域的样式以适应不同纸张
function updatePreviewAreaStyle(settings) {
    const previewContent = document.getElementById('previewContent');
    
    // 判断是否为小尺寸纸张
    const isSmallPaper = settings.paperSize === '70x70mm' || 
                         (settings.paperSize === 'custom' && 
                          parseFloat(settings.customWidth) < 75 && 
                          parseFloat(settings.customHeight) < 75);
    
    if (isSmallPaper) {
        // 小纸张预览样式
        previewContent.style.minHeight = '300px';
        previewContent.style.maxHeight = '400px';
        previewContent.style.padding = '10px';
        previewContent.className = 'preview-content preview-content-small';
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
        
        // 如果还没有生成PDF，先生成
        if (!currentPdfPath) {
            await previewLabel();
        }
        
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

// 输入记忆功能
function setupInputMemory() {
    const inputs = document.querySelectorAll('input[type="text"], textarea');
    
    inputs.forEach(input => {
        // 获取输入历史
        input.addEventListener('focus', (e) => {
            showSuggestions(e.target);
        });
        
        // 更新输入历史 - 修改blur事件处理
        input.addEventListener('blur', (e) => {
            // 延迟执行，给点击建议项留出时间
            setTimeout(() => {
                updateInputHistory(e.target.id, e.target.value);
                hideSuggestions();
            }, 250);
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
        
        if (!isInput && !isSuggestion) {
            hideSuggestions();
        }
    });
}

// 显示建议列表
function showSuggestions(input) {
    // 确保输入框没有被禁用
    if (input.disabled || input.readOnly) {
        return;
    }
    
    const fieldId = input.id;
    if (!fieldId) return; // 没有ID的输入框不显示建议
    
    const history = inputHistory[fieldId] || [];
    const currentValue = input.value.toLowerCase();
    
    const filtered = history.filter(item => 
        item && item.toLowerCase().includes(currentValue)
    );
    
    const suggestionList = document.getElementById('suggestionList');
    
    if (filtered.length === 0) {
        hideSuggestions();
        return;
    }
    
    suggestionList.innerHTML = '';
    
    filtered.slice(0, 10).forEach((item, index) => { // 限制最多显示10个建议
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = item;
        div.dataset.index = index;
        
        // 使用mousedown而不是click，避免blur事件冲突
        div.addEventListener('mousedown', (e) => {
            e.preventDefault(); // 阻止默认行为，防止输入框失去焦点
            input.value = item;
            hideSuggestions();
            // 触发input事件，以便其他监听器能够响应
            input.dispatchEvent(new Event('input', { bubbles: true }));
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
}


// 隐藏建议列表
function hideSuggestions() {
    const suggestionList = document.getElementById('suggestionList');
    if (suggestionList) {
        suggestionList.style.display = 'none';
        suggestionList.innerHTML = ''; // 清空内容，避免残留
    }
}

// 处理建议列表键盘导航
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
            }
            return;
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