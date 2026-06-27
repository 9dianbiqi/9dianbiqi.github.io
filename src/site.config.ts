import heroImage from './assets/home/astro-learning-desk.png';

export const site = {
  title: '9dianbiqi | Astro 技术博客',
  description: '记录 Astro、前端工程和个人学习路径的技术博客。',
  author: '9dianbiqi',
  url: 'https://9dianbiqi.github.io',
  githubUrl: 'https://github.com/9dianbiqi',
};

export const home = {
  hero: {
    eyebrow: 'Astro / Frontend / Notes',
    title: '把学习过程写成可以反复使用的个人知识库。',
    description:
      '这里记录我搭建个人博客、学习前端框架和整理工程实践的过程。第一篇从 Astro 开始：为什么选它、如何组织内容、怎样发布到 GitHub Pages。',
    image: heroImage,
    imageAlt: '书桌上的笔记本电脑、前端草图和 Markdown、Components、Deploy 学习卡片',
    actions: [
      { label: '阅读第一篇', href: '/blog/how-to-use-astro/', variant: 'primary' },
      { label: '查看文章', href: '/blog/', variant: 'secondary' },
    ],
  },
  featured: {
    eyebrow: 'Start Here',
    title: '第一条博客',
  },
  learningPath: {
    eyebrow: 'Learning Path',
    title: '我会这样学习 Astro',
    items: [
      {
        step: '01',
        title: '先跑通项目',
        text: '从最小可运行项目开始，理解页面路由、布局和静态构建。',
      },
      {
        step: '02',
        title: '再组织内容',
        text: '用 Content Collections 管理 Markdown，让文章元数据可校验、可排序。',
      },
      {
        step: '03',
        title: '最后自动发布',
        text: '把构建交给 GitHub Actions，主分支推送后自动更新 GitHub Pages。',
      },
    ],
  },
  imageStrip: {
    eyebrow: 'Homepage System',
    title: '第一版首页配置',
    items: [
      {
        title: '主图资产',
        text: '首页图片从配置读取，并交给 Astro 图片管线处理尺寸与性能。',
        image: heroImage,
        imageAlt: '学习 Astro 的桌面主图局部',
        objectPosition: 'center',
      },
      {
        title: '内容模块',
        text: '首页模块拆成组件，后续新增栏目时只改配置和少量组件。',
        image: heroImage,
        imageAlt: 'Markdown、Components、Deploy 学习卡片局部',
        objectPosition: 'bottom',
      },
      {
        title: '轻量动效',
        text: '滚动进入时轻微出现，并尊重系统的 reduced motion 设置。',
        image: heroImage,
        imageAlt: '笔记本电脑上的代码编辑器局部',
        objectPosition: 'right',
      },
    ],
  },
};
