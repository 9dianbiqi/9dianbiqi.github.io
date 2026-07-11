---
title: "如何把本地动态视频做成 Astro 博客首页背景"
description: "记录一次把 Steam Workshop 本地 MP4 素材接入 Astro 首页 Hero 背景的完整实现方案。"
pubDate: 2026-07-12
heroImage: "/media/home/hero-poster.jpg"
heroAlt: "动态视频背景的预览封面"
tags: ["Astro", "前端设计", "GitHub Pages"]
readingTime: "约 5 分钟"
draft: false
---

我这次想把博客首页从静态图片升级成动态视频背景。素材来自本机的 Steam Workshop 目录：

```text
D:\steam\steamapps\workshop\content\431960\2488465732
```

这个目录里有 `preview.jpg` 和一个 MP4 视频。网页不能直接引用 `D:\...` 这样的本地路径，因为 GitHub Pages 和其他访客都访问不到它。正确做法是把素材复制到博客项目的 `public` 目录，再用站点路径引用。

## 1. 放置公开媒体资源

我把文件整理成了更稳定的 ASCII 文件名：

```text
public/
  media/
    home/
      hero-video.mp4
      hero-poster.jpg
```

这样上线后，浏览器访问的就是：

```text
/media/home/hero-video.mp4
/media/home/hero-poster.jpg
```

`poster` 很重要。视频还没加载完成、移动端省流量、或者浏览器暂停自动播放时，它会作为首屏兜底画面。

## 2. 在首页配置里声明视频

我没有把路径硬编码在组件里，而是放进 `src/site.config.ts`：

```ts
export const home = {
  hero: {
    video: {
      src: '/media/home/hero-video.mp4',
      poster: '/media/home/hero-poster.jpg',
      type: 'video/mp4',
    },
  },
};
```

这样以后换视频时，只需要替换文件或改配置，不用在页面组件里到处找路径。

## 3. 在 HomeHero 组件里渲染背景视频

首页组件 `src/components/HomeHero.astro` 会在存在 `hero.video` 时渲染一个装饰性视频背景：

```astro
<video autoplay muted loop playsinline poster={hero.video.poster}>
  <source src={hero.video.src} type={hero.video.type ?? 'video/mp4'} />
</video>
```

这里有几个关键点：

- `autoplay` 让它进入首页后自动播放。
- `muted` 是自动播放的必要条件之一，否则很多浏览器会拦截。
- `loop` 让背景循环播放。
- `playsinline` 避免移动端强制进入全屏播放。
- `poster` 提供加载前的静态封面。

这类视频只负责氛围，不负责传达正文信息，所以组件里把视频容器标成了 `aria-hidden="true"`，避免读屏器把它当成主要内容。

## 4. 用 CSS 做首屏背景和遮罩

视频本身铺满整个 Hero 区域：

```css
.hero-video-background video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

文字直接压在视频上，但为了可读性，页面加了两层渐变遮罩：

```css
.hero-video-section::after {
  background:
    linear-gradient(90deg, rgba(16, 35, 38, 0.82), rgba(16, 35, 38, 0.18)),
    linear-gradient(180deg, rgba(16, 35, 38, 0.2), rgba(16, 35, 38, 0.78));
}
```

这样视频仍然能动，但标题、简介和按钮不会被画面亮部干扰。

## 5. 性能注意

当前 MP4 大约 38 MB，作为第一版可以跑通，但长期最好再做压缩：

```text
hero-video.webm
hero-video.mp4
hero-poster.jpg
```

理想目标是把首页视频控制在 5-15 MB。可以用 `ffmpeg` 输出更适合网页的版本，再在 `<video>` 里提供多个 `<source>`：

```astro
<video autoplay muted loop playsinline poster="/media/home/hero-poster.jpg">
  <source src="/media/home/hero-video.webm" type="video/webm" />
  <source src="/media/home/hero-video.mp4" type="video/mp4" />
</video>
```

浏览器会优先选择自己支持的格式。

## 6. 最终发布流程

这次实现完成后，我用这几条命令验证：

```bash
npm run verify:home-video
npm run verify:home
npm run build
```

然后提交并推送到 GitHub。GitHub Pages 会自动构建，首页就能看到动态视频背景。

下一步如果要继续增强，可以在首页右下角加入一个简易音乐播放器。但音乐通常不能自动播放，最好设计成用户点击后再播放，和视频背景分开处理。
