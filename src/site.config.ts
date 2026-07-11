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
    eyebrow: 'Frontend / Cloud / Data / Security',
    title: '把复杂技术整理成可以随时回看的清晰笔记。',
    description:
      '记录前端工程、云基础设施、数据库与安全实践，把学习过程沉淀成可检索、可复用的个人知识库。',
    image: heroImage,
    imageAlt: '书桌上的笔记本电脑、前端草图和 Markdown、Components、Deploy 学习卡片',
    video: {
      src: '/media/home/hero-video.mp4',
      poster: '/media/home/hero-poster.jpg',
      type: 'video/mp4',
    },
    actions: [
      { label: '阅读最新文章', href: '/blog/', variant: 'primary' },
      { label: '浏览全部文章', href: '/blog/', variant: 'secondary' },
    ],
  },
  recent: {
    eyebrow: 'Latest Notes',
    title: '最近更新',
    description: '从最新整理的实践笔记开始，快速了解近期关注的技术主题。',
  },
  topics: {
    eyebrow: 'Topics',
    title: '从专题开始',
    description: '按稳定主题串起相关笔记，比在时间线里逐篇寻找更高效。',
    items: [
      {
        tag: '云原生',
        description: '从 ECS、Kubernetes 到分布式系统，建立基础设施视角。',
      },
      {
        tag: '数据库',
        description: '围绕数据库操作、数据流转与安全保存整理实用清单。',
      },
      {
        tag: '前端工程',
        description: '记录 Vue、Astro 与系统集成中的工程化实践。',
      },
      {
        tag: '安全',
        description: '理解身份认证、网络访问和真实业务中的安全边界。',
      },
    ],
  },
};
