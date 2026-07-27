import {
  findMermaidBlocks,
  renderMermaidBlocks,
  type MermaidRender,
} from '../lib/mermaidDiagrams';

export interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  render: MermaidRender;
}

export type MermaidModuleLoader = () => Promise<{ default: MermaidApi }>;

const MERMAID_THEME = {
  background: '#fffdf8',
  primaryColor: '#eef3ed',
  primaryTextColor: '#141817',
  primaryBorderColor: '#123d3e',
  lineColor: '#667853',
  secondaryColor: '#f8f4ea',
  tertiaryColor: '#fffdf8',
  noteBkgColor: '#f8f4ea',
  noteBorderColor: '#b55f46',
  fontFamily:
    'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif',
};

const defaultLoader: MermaidModuleLoader = async () => ({
  default: (await import('mermaid')).default as unknown as MermaidApi,
});

export function createMermaidInitializer(loadModule: MermaidModuleLoader = defaultLoader) {
  let apiPromise: Promise<MermaidApi> | undefined;
  let activeRender: Promise<number> | undefined;

  return async (root: Document = document): Promise<number> => {
    if (findMermaidBlocks(root).length === 0) return 0;
    if (activeRender) return activeRender;

    apiPromise ??= loadModule().then(({ default: api }) => {
      api.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: MERMAID_THEME,
      });
      return api;
    });

    activeRender = apiPromise
      .then((api) => renderMermaidBlocks(root, api.render.bind(api)))
      .finally(() => {
        activeRender = undefined;
      });

    return activeRender;
  };
}

const initializeMermaidDiagrams = createMermaidInitializer();
const renderCurrentPage = () => void initializeMermaidDiagrams(document);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderCurrentPage, { once: true });
} else {
  renderCurrentPage();
}

document.addEventListener('astro:page-load', renderCurrentPage);
