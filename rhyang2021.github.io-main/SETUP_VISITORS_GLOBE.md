# 如何设置访客地球（Visitors Globe）

## 方法一：使用 ClustrMaps 3D 地球

1. 访问 [https://clustrmaps.com/](https://clustrmaps.com/)

2. 点击 "Add Your Free Map" 或 "Get Started"

3. 注册账号（可以使用邮箱注册）

4. 填写你的网站信息：
   - Website URL: `你的网站地址`
   - Website Name: `Ruihan Yang's Homepage`
   
5. 选择地图类型：
   - 选择 "Globe" (3D地球) 样式
   - 可以选择暗色主题（与参考网站相同）

6. 获取代码：
   - 复制提供的 JavaScript 代码
   - 替换 `index.html` 中的：
     ```javascript
     <script type="text/javascript" id="clstr_globe" src="//clustrmaps.com/globe.js?d=YOUR_MAP_ID"></script>
     ```
   - 将 `YOUR_MAP_ID` 替换为你的实际 Map ID

## 方法二：使用简单的访客计数器

如果你想要更简单的访客统计，可以使用：

```html
<a href="https://clustrmaps.com/site/YOUR_SITE_ID" title="Visit tracker">
  <img src="//clustrmaps.com/map_v2.png?d=YOUR_MAP_ID&cl=ffffff&w=a" />
</a>
```

## 方法三：使用其他访客统计服务

- **Revolver Maps**: [https://www.revolvermaps.com/](https://www.revolvermaps.com/)
- **Flag Counter**: [https://flagcounter.com/](https://flagcounter.com/)

## 设置步骤

1. 打开 `index.html`
2. 找到底部 footer 部分的 `visitors-section`
3. 替换对应的代码
4. 保存并刷新页面

## 注意事项

- 地球需要一段时间来收集访客数据（通常几天后才能看到效果）
- 确保你的网站是公开可访问的
- 第一次访问可能需要等待几秒钟加载地球模型

