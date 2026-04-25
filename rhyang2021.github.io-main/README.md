# 学术主页模板

一个简约优雅的学术主页模板，灵感来自 [Siyu Yuan](https://siyuyuan.github.io/) 的个人主页。

## 预览

![预览](./preview.png)

## 特点

- ✨ 简约清晰的设计风格
- 📱 完全响应式布局（支持手机/平板/桌面）
- 🎨 现代 CSS，无需额外依赖
- 🖼️ 支持头像和论文缩略图
- 📝 包含完整的内容板块：
  - 个人信息与联系方式
  - 研究兴趣介绍
  - News 时间线
  - 论文列表（带缩略图）
  - 实习/工作经历
  - 获奖情况

## 使用方法

### 1. 基础设置

编辑 `index.html` 文件，替换以下内容：

#### 个人信息区域
```html
<!-- 第 23-38 行 -->
<img src="images/avatar.jpg" alt="Your Name">  <!-- 替换为你的头像 -->
<h1 class="name">Your Name</h1>               <!-- 你的姓名 -->
<p class="bio">...</p>                        <!-- 个人简介 -->
<p class="job-market">...</p>                 <!-- 求职信息（可选） -->
<div class="links">...</div>                  <!-- 联系方式链接 -->
```

#### 研究兴趣
```html
<!-- 第 48-60 行 -->
<section class="research">
    <h2 class="section-title">Research: Your Research Area</h2>
    <!-- 修改研究主题列表 -->
</section>
```

#### News
```html
<!-- 第 63-73 行 -->
<ul class="news-list">
    <li><span class="news-date">日期</span> 新闻内容</li>
</ul>
```

#### 论文列表
```html
<!-- 第 76-130 行 -->
<div class="paper">
    <div class="paper-image">
        <img src="images/paper1.jpg">  <!-- 论文缩略图 -->
    </div>
    <div class="paper-info">
        <h3 class="paper-title">论文标题</h3>
        <p class="paper-authors">作者列表</p>
        <p class="paper-venue">发表会议/期刊</p>
        <div class="paper-links">相关链接</div>
    </div>
</div>
```

### 2. 添加图片

将图片放入 `images` 文件夹：

- `avatar.jpg` - 个人头像（建议正方形，会被裁剪为圆形）
- `paper1.jpg`, `paper2.jpg`... - 论文缩略图（建议 16:10 比例）

如果没有图片，会显示默认的占位符。

### 3. 部署到 GitHub Pages

#### 方法 A: 通过 GitHub Web 界面

1. 在 GitHub 创建新仓库，命名为 `yourusername.github.io`
2. 上传所有文件到仓库
3. 访问 `https://yourusername.github.io` 即可看到主页

#### 方法 B: 通过命令行

```bash
# 初始化 Git 仓库
cd academic-homepage
git init
git add .
git commit -m "Initial commit"

# 推送到 GitHub
git remote add origin https://github.com/yourusername/yourusername.github.io.git
git push -u origin main
```

#### 方法 C: 使用现有仓库

如果你想在现有仓库的子目录中部署：

1. 将文件推送到仓库的 `main` 分支
2. 进入仓库 Settings → Pages
3. Source 选择 "Deploy from a branch"
4. 选择 `main` 分支和 `/ (root)` 或 `/docs` 文件夹

## 自定义样式

### 修改颜色

编辑 `style.css` 文件开头的 `:root` 部分：

```css
:root {
    --text-primary: #1a1a1a;    /* 主文字颜色 */
    --text-secondary: #4a4a4a;  /* 次要文字颜色 */
    --link-color: #2563eb;      /* 链接颜色（蓝色） */
    --accent-color: #dc2626;    /* 强调色（红色，用于会议名等） */
    --border-color: #e5e5e5;    /* 边框颜色 */
    --bg-light: #f8f9fa;        /* 浅背景色 */
}
```

### 修改字体

在 `index.html` 的 `<head>` 中替换 Google Fonts 链接：

```html
<!-- 例如改为思源宋体 -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet">
```

然后在 `style.css` 中修改：
```css
body {
    font-family: 'Noto Serif SC', serif;
}
```

## 文件结构

```
academic-homepage/
├── index.html          # 主页 HTML
├── style.css           # 样式文件
├── README.md           # 本说明文件
├── images/
│   ├── avatar.jpg      # 个人头像
│   ├── paper1.jpg      # 论文缩略图 1
│   ├── paper2.jpg      # 论文缩略图 2
│   └── ...
└── cv.pdf              # 简历文件（可选）
```

## 进阶定制

### 添加 Google Analytics

在 `index.html` 的 `</head>` 前添加：

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### 添加访客计数器

可以使用 [Visitor Badge](https://visitor-badge.glitch.me/) 等服务：

```html
<!-- 在 sidebar 的 profile div 中添加 -->
<img src="https://visitor-badge.glitch.me/badge?page_id=yourusername.yourusername.github.io" alt="Visitors">
```

## 许可证

本模板采用 MIT 许可证，可自由使用和修改。

## 致谢

- 设计灵感: [Siyu Yuan](https://siyuyuan.github.io/)
- 字体: [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)
