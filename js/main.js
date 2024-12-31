/*******************************************
* 页面加载后的初始化逻辑
*******************************************/
window.onload = () => {
    // 拖拽 & 点击上传
    const dropArea = document.getElementById("dropArea");
    const imageUpload = document.getElementById("imageUpload");
    dropArea.addEventListener("dragover", function(event) {
        event.preventDefault();
        dropArea.classList.add("dragover");
    });
    dropArea.addEventListener("dragleave", function(event) {
        dropArea.classList.remove("dragover");
        event.preventDefault();
    });
    dropArea.addEventListener("drop", function(event) {
        event.preventDefault();
        dropArea.classList.remove("dragover");
        const file = event.dataTransfer.files[0];
        handleFile(file);
    });
    imageUpload.addEventListener("change", function(event) {
        const file = event.target.files[0];
        handleFile(file);
    });
    // 复制图标事件
    const copyPositiveIcon = document.getElementById("copyPositiveIcon");
    copyPositiveIcon.addEventListener("click", () => {
        const text = document
            .getElementById("positivePromptText")
            .innerText.replace("正向提示词:\n", "");
        copyToClipboard(text);
    });
    const copyNegativeIcon = document.getElementById("copyNegativeIcon");
    copyNegativeIcon.addEventListener("click", () => {
        const text = document
            .getElementById("negativePromptText")
            .innerText.replace("负向提示词:\n", "");
        copyToClipboard(text);
    });
};
/*******************************************
* 处理文件：检查文件类型并读取
*******************************************/
function handleFile(file) {
    // 如果没有选择文件（例如用户点了选择又取消），则直接返回，不清空已存在数据
    if (!file) {
        return;
    }
    // 如果不是 PNG，给出提示并返回，也不清空
    if (!file.type.startsWith("image/png")) {
        alert("请选择 PNG 图片");
        return;
    }
    // ======= 能走到这里，说明一定是新选择并且是 PNG 文件，才清空并解析 =======
    const metaDataOutput = document.getElementById("metaDataOutput");
    const imagePreview = document.getElementById("imagePreview");
    const uploadPlaceholder = document.getElementById("uploadPlaceholder");
    const promptSection = document.querySelector(".prompt-section");
    const metaDataContainer = document.querySelector(".meta-data-container");
    const promptSectionTitle = document.getElementById("prompt-section-title");
    const positivePromptBox = document.getElementById("positivePromptBox");
    const negativePromptBox = document.getElementById("negativePromptBox");
    const toggleMetaDataButton = document.getElementById("toggleMetaData");
    // 清空提示区域，准备载入新图片
    metaDataOutput.innerText = "";
    promptSectionTitle.style.display = "none";
    positivePromptBox.style.display = "none";
    negativePromptBox.style.display = "none";
    toggleMetaDataButton.style.display = "none";
    // 读文件
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = "block";
        uploadPlaceholder.style.display = "none"; // 隐藏占位符
        // 显示文本框和元数据区域
        promptSection.style.display = "block";
        metaDataContainer.style.display = "block";
        parsePNGMetaData(e.target.result);
    };
    reader.readAsDataURL(file);
}
/*******************************************
* 解析 PNG MetaData (与之前版本一致，此处省略注释)
*******************************************/
function parsePNGMetaData(dataUrl) {
    const metaDataOutput = document.getElementById("metaDataOutput");
    const promptSectionTitle = document.getElementById("prompt-section-title");
    const positivePromptBox = document.getElementById("positivePromptBox");
    const negativePromptBox = document.getElementById("negativePromptBox");
    const toggleMetaDataButton = document.getElementById("toggleMetaData");
    // 先清空
    metaDataOutput.innerText = "";
    promptSectionTitle.style.display = "none";
    positivePromptBox.style.display = "none";
    negativePromptBox.style.display = "none";
    toggleMetaDataButton.style.display = "none";
    // Base64 解码为二进制
    const base64String = dataUrl.split(",")[1];
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    let metaDataText = "";
    let foundText = false;
    // 提取到的提示词
    let comfyPositive = "";
    let comfyNegative = "";
    let novelAIPrompt = "";
    let novelAINegative = "";
    let stablePositive = "";
    let stableNegative = "";
    // 遍历 PNG 文件块
    for (let i = 8; i < bytes.length - 8;) {
        const chunkLength =
            (bytes[i] << 24) |
            (bytes[i + 1] << 16) |
            (bytes[i + 2] << 8) |
            bytes[i + 3];
        const chunkType = String.fromCharCode(
            bytes[i + 4],
            bytes[i + 5],
            bytes[i + 6],
            bytes[i + 7]
        );
        if (chunkType === "tEXt" || chunkType === "zTXt") {
            let textDataIndex = i + 8;
            let key = "";
            while (
                textDataIndex < i + 8 + chunkLength &&
                bytes[textDataIndex] !== 0
            ) {
                key += String.fromCharCode(bytes[textDataIndex]);
                textDataIndex++;
            }
            let text = "";
            if (chunkType === "tEXt") {
                for (let j = textDataIndex + 1; j < i + 8 + chunkLength; j++) {
                    text += String.fromCharCode(bytes[j]);
                }
            } else if (chunkType === "zTXt") {
                let compressionMethod = bytes[textDataIndex + 1];
                if (compressionMethod === 0) {
                    let compressedData = bytes.slice(
                        textDataIndex + 2,
                        i + 8 + chunkLength
                    );
                    try {
                        text = String.fromCharCode(...pako.inflate(compressedData));
                    } catch (error) {
                        text = "解压失败";
                    }
                }
            }
            // ComfyUI
            if (key === "prompt") {
                try {
                    const promptData = JSON.parse(text);
                    let isComfyUI = false;
                    for (const nodeKey in promptData) {
                        const node = promptData[nodeKey];
                        if (node && node.class_type === "easy fullLoader" && node.inputs) {
                            comfyPositive = node.inputs.positive || "";
                            comfyNegative = node.inputs.negative || "";
                            isComfyUI = true;
                            break;
                        }
                    }
                    metaDataText += `${key} : ${text}\n`;
                    foundText = true;
                } catch (err) {
                    metaDataText += `${key} : ${text}\n`;
                    foundText = true;
                }
            }
            // NovelAI
            else if (key.toLowerCase() === "comment") {
                try {
                    const commentData = JSON.parse(text);
                    if (commentData.prompt && commentData.uc) {
                        novelAIPrompt = commentData.prompt;
                        novelAINegative = commentData.uc;
                    }
                    metaDataText += `${key} : ${text}\n`;
                    foundText = true;
                } catch (err) {
                    metaDataText += `${key} : ${text}\n`;
                    foundText = true;
                }
            }
            // 其他元数据
            else {
                metaDataText += `${key} : ${text}\n`;
                foundText = true;
            }
        }
        i += 12 + chunkLength;
    }
    if (!foundText) {
        metaDataOutput.innerText = "未找到 PNG 元数据";
        return;
    }
    // Stable Diffusion
    if (!comfyPositive && !comfyNegative && !novelAIPrompt && !novelAINegative) {
        const sdInfo = parseStableDiffusionData(metaDataText);
        stablePositive = sdInfo.positive;
        stableNegative = sdInfo.negative;
    }
    // 默认先隐藏元数据
    metaDataOutput.innerText = metaDataText;
    metaDataOutput.style.display = "none";             
    toggleMetaDataButton.style.display = "block";
    toggleMetaDataButton.innerText = "显示完整元数据";  
    toggleMetaDataButton.onclick = () => {
        if (metaDataOutput.style.display === "none") {
            metaDataOutput.style.display = "block";
            toggleMetaDataButton.innerText = "隐藏完整元数据";
        } else {
            metaDataOutput.style.display = "none";
            toggleMetaDataButton.innerText = "显示完整元数据";
        }
    };
    // 设置正、负向提示词
    let finalPositive = "";
    let finalNegative = "";
    if (comfyPositive || comfyNegative) {
        finalPositive = comfyPositive;
        finalNegative = comfyNegative;
    } else if (novelAIPrompt || novelAINegative) {
        finalPositive = novelAIPrompt;
        finalNegative = novelAINegative;
    } else {
        finalPositive = stablePositive;
        finalNegative = stableNegative;
    }
    if (finalPositive || finalNegative) {
        promptSectionTitle.style.display = "block";
        const positivePromptText = document.getElementById("positivePromptText");
        const negativePromptText = document.getElementById("negativePromptText");
        positivePromptBox.style.display = "block";
        negativePromptBox.style.display = "block";
        positivePromptText.innerText = `正向提示词:\n${finalPositive}`;
        negativePromptText.innerText = `负向提示词:\n${finalNegative}`;
    }
}
/*******************************************
* 解析 Stable Diffusion 的纯文本信息
*******************************************/
function parseStableDiffusionData(text) {
    let positive = "";
    let negative = "";
     // 寻找“parameters :”
    const patternPos = /parameters :(.*?)(?=Negative prompt:|$)/is;
    const matchPos = text.match(patternPos);
    if (matchPos && matchPos[1]) {
      positive = matchPos[1].trim();
    }
    // 寻找“Negative prompt:”
    const patternNeg = /Negative prompt:\s*([^]*)/i;
    const matchNeg = text.match(patternNeg);
    if (matchNeg && matchNeg[1]) {
        const possibleNegative = matchNeg[1].split("Steps:")[0];
        negative = possibleNegative.trim();
    }
    return {
        // 直接返回 cleanStablePrompt 的结果，不再进行 split 和 join
        positive: cleanStablePrompt(positive),
        negative: cleanStablePrompt(negative),
    };
}
/*******************************************
* 对 Stable Diffusion 提示词做简单清洗
*******************************************/
function cleanStablePrompt(rawPrompt) {
    if (!rawPrompt) return "";
    // 将 BREAK 替换为 \n，合并多个连续换行符，并去除开头结尾的空行
    return rawPrompt.trim().replace(/BREAK/g, "\n").replace(/\n+/g, '\n').trim();
}
/*******************************************
* 复制到剪贴板
*******************************************/
function copyToClipboard(text) {
    if (!text) return;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    alert("已复制到剪贴板");
}
