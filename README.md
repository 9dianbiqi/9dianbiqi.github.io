# 9dianbiqi Astro Blog

这是一个使用 Astro 生成、通过 GitHub Pages 发布的个人技术博客。

## 本地开发

```bash
npm install
npm run dev
```

## 构建验证

```bash
npm run build
```

## 发布

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会使用 Astro 官方 GitHub Action 构建站点，并通过 GitHub Pages 发布到：

https://9dianbiqi.github.io
