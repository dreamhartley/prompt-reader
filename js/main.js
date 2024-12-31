/*******************************************
 * 页面加载后的初始化逻辑
 *******************************************/
window.onload = () => {
  // 标签切换逻辑
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab");

      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      tabContents.forEach((content) => {
        content.classList.remove("active");
        if (content.id === tabId) {
          content.classList.add("active");
        }
      });
    });
  });

  // 转义字符转换按钮
  const convertButton = document.getElementById("convertButton");
  convertButton.addEventListener("click", convertText);

  // 拖拽 & 点击上传
  const dropArea = document.getElementById("dropArea");
  const imageUpload = document.getElementById("imageUpload");

  dropArea.addEventListener("dragover", function (event) {
    event.preventDefault();
    dropArea.classList.add("dragover");
  });

  dropArea.addEventListener("dragleave", function (event) {
    dropArea.classList.remove("dragover");
    event.preventDefault();
  });

  dropArea.addEventListener("drop", function (event) {
    event.preventDefault();
    dropArea.classList.remove("dragover");
    const file = event.dataTransfer.files[0];
    handleFile(file);
  });

  dropArea.addEventListener("click", function () {
    imageUpload.click();
  });

  imageUpload.addEventListener("change", function (event) {
    const file = event.target.files[0];
    handleFile(file);
  });

  // 复制图标事件
  const copyPositiveIcon = document.getElementById("copyPositiveIcon");
  copyPositiveIcon.addEventListener("click", () => {
    const text = document.getElementById("positivePromptText").innerText;
    copyToClipboard(text);
  });

  const copyNegativeIcon = document.getElementById("copyNegativeIcon");
  copyNegativeIcon.addEventListener("click", () => {
    const text = document.getElementById("negativePromptText").innerText;
    copyToClipboard(text);
  });
};

/*******************************************
 * 转义字符转换逻辑
 *******************************************/
function convertText() {
  const input = document.getElementById("inputArea").value;
  const outputDiv = document.getElementById("outputArea");

  // 将 \n、\r、\t 等转义字符替换为实际换行、制表符等
  let convertedText = input
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");

  outputDiv.innerText = convertedText;
}

/*******************************************
 * 处理文件：检查文件类型并读取
 *******************************************/
function handleFile(file) {
  const metaDataOutput = document.getElementById("metaDataOutput");
  const imagePreview = document.getElementById("imagePreview");
  const promptSectionTitle = document.getElementById("prompt-section-title");
  const positivePromptBox = document.getElementById("positivePromptBox");
  const negativePromptBox = document.getElementById("negativePromptBox");
  const toggleMetaDataButton = document.getElementById("toggleMetaData");

  // 清空提示区域
  metaDataOutput.innerText = "";
  imagePreview.style.display = "none";
  promptSectionTitle.style.display = "none";
  positivePromptBox.style.display = "none";
  negativePromptBox.style.display = "none";
  toggleMetaDataButton.style.display = "none";

  if (!file) return;

  // 只接收 PNG
  if (!file.type.startsWith("image/png")) {
    metaDataOutput.innerText = "请选择 PNG 图片";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    imagePreview.style.display = "block";
    parsePNGMetaData(e.target.result);
  };
  reader.readAsDataURL(file);
}

/*******************************************
 * 解析 PNG MetaData
 * 1. 若检测到 ComfyUI: 通过 "class_type":"easy fullLoader"
 * 2. 若检测到 NovelAI:  key="Comment" 的 JSON 中包含 prompt & uc
 * 3. 若检测到 Stable Diffusion: 识别文本 "Negative prompt:"、"Steps:" 等
 * 4. 都不是则原样显示
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

  let metaDataText = ""; // 拼接所有元数据
  let foundText = false;

  // 提取到的提示词
  let comfyPositive = "";
  let comfyNegative = "";

  let novelAIPrompt = "";
  let novelAINegative = "";

  let stablePositive = "";
  let stableNegative = "";

  // 遍历 PNG 文件块
  for (let i = 8; i < bytes.length - 8; ) {
    const chunkLength =
      (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
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

      // 1) 若 key === "prompt" => 检测 ComfyUI
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
          // 解析失败，当普通文本
          metaDataText += `${key} : ${text}\n`;
          foundText = true;
        }
      }
      // 2) 若 key === "Comment" => 可能是 NovelAI
      else if (key.toLowerCase() === "comment") {
        try {
          const commentData = JSON.parse(text);
          // NovelAI 关键字段: commentData.prompt, commentData.uc
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
      // 3) 其他情况 => 原样显示
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

  // 额外判断 Stable Diffusion
  // 若既不是 ComfyUI 也不是 NovelAI，则尝试解析 metaDataText 看能否找到 SD 格式提示
  if (!comfyPositive && !comfyNegative && !novelAIPrompt && !novelAINegative) {
    const sdInfo = parseStableDiffusionData(metaDataText);
    stablePositive = sdInfo.positive;
    stableNegative = sdInfo.negative;
  }

  // 显示完整元数据
  metaDataOutput.innerText = metaDataText;
  toggleMetaDataButton.style.display = "block";
  toggleMetaDataButton.onclick = () => {
    if (
      metaDataOutput.style.display === "none" ||
      metaDataOutput.style.display === ""
    ) {
      metaDataOutput.style.display = "block";
      toggleMetaDataButton.innerText = "隐藏完整元数据";
    } else {
      metaDataOutput.style.display = "none";
      toggleMetaDataButton.innerText = "显示完整元数据";
    }
  };

  // 决定最终显示的正、负提示词
  let finalPositive = "";
  let finalNegative = "";

  // 优先顺序：ComfyUI -> NovelAI -> Stable Diffusion
  if (comfyPositive || comfyNegative) {
    finalPositive = comfyPositive;
    finalNegative = comfyNegative;
  } else if (novelAIPrompt || novelAINegative) {
    finalPositive = novelAIPrompt;
    finalNegative = novelAINegative;
  } else if (stablePositive || stableNegative) {
    finalPositive = stablePositive;
    finalNegative = stableNegative;
  }

  if (finalPositive || finalNegative) {
    promptSectionTitle.style.display = "block";

    const positivePromptText = document.getElementById("positivePromptText");
    const negativePromptText = document.getElementById("negativePromptText");

    positivePromptBox.style.display = "block";
    negativePromptBox.style.display = "block";

    positivePromptText.innerText = `${finalPositive}`;
    negativePromptText.innerText = `${finalNegative}`;
  }
}

/*******************************************
 * 尝试解析 Stable Diffusion 的纯文本信息
 * 比如：
 *   Negative prompt: xxx
 *   Steps: 25, Sampler: ...
 *******************************************/
function parseStableDiffusionData(text) {
  let positive = "";
  let negative = "";

  // 寻找“Negative prompt:”
  const patternNeg = /Negative prompt:\s*([^]*)/i;
  const matchNeg = text.match(patternNeg);
  if (matchNeg && matchNeg[1]) {
    // 截取直到 "Steps:" 或行尾
    const possibleNegative = matchNeg[1].split("Steps:")[0];
    negative = possibleNegative.trim();
  }

  // 正向提示词：取 Negative prompt: 之前的内容
  let indexOfNegPrompt = text.toLowerCase().indexOf("negative prompt:");
  if (indexOfNegPrompt > 0) {
    positive = text.slice(0, indexOfNegPrompt).trim();
  }

  return {
    positive: cleanStablePrompt(positive),
    negative: cleanStablePrompt(negative),
  };
}

/*******************************************
 * 对 Stable Diffusion 提示词做简单清洗
 *******************************************/
function cleanStablePrompt(rawPrompt) {
  if (!rawPrompt) return "";
  return rawPrompt.replace(/\s+$/, "");
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
