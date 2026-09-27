import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// 1. 设置原图片文件夹路径，以及压缩后输出的文件夹路径
const INPUT_DIR = 'D:/专辑封面';
const OUTPUT_DIR = 'D:/专辑封面/webp_compressed';

async function processImages() {
  // 如果输出目录不存在，则自动创建
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 读取原文件夹中的所有文件
  const files = fs.readdirSync(INPUT_DIR);
  const imageFiles = files.filter(file => /\.(jpe?g|png)$/i.test(file));

  console.log(`🚀 找到 ${imageFiles.length} 张图片，开始极速批量转换...\n`);

  let count = 0;
  for (const file of imageFiles) {
    const inputPath = path.join(INPUT_DIR, file);
    // 保持原文件名，仅将后缀替换为 .webp
    const baseName = path.parse(file).name;
    const outputPath = path.join(OUTPUT_DIR, `${baseName}.webp`);

    try {
      await sharp(inputPath)
        .resize(600, 600, {
          fit: 'cover',        // 若原图不是正方形，居中裁切填满
          position: 'center'
        })
        .webp({
          quality: 80          // 80 质量兼顾清晰度与体积，每张仅约 40~80 KB
        })
        .toFile(outputPath);

      count++;
      console.log(`[${count}/${imageFiles.length}] ✅ 转换成功: ${baseName}.webp`);
    } catch (err) {
      console.error(`❌ 处理失败: ${file}`, err.message);
    }
  }

  console.log(`\n🎉 全部处理完成！压缩后的文件位于: ${OUTPUT_DIR}`);
}

processImages();