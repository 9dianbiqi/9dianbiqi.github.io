// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getMermaidLabel,
  renderMermaidBlocks,
  type MermaidRender,
} from './mermaidDiagrams';

describe('renderMermaidBlocks', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('replaces a Mermaid source block only after rendering succeeds', async () => {
    document.body.innerHTML = `
      <article>
        <h2>系统流程</h2>
        <pre data-language="mermaid"><code>flowchart LR
  A["输入"] --> B["输出"]</code></pre>
      </article>
    `;
    const calls: Array<{ id: string; source: string }> = [];
    const render: MermaidRender = async (id, source) => {
      calls.push({ id, source });
      return {
        svg: '<svg viewBox="0 0 640 320"><title>Rendered diagram</title></svg>',
      };
    };

    const count = await renderMermaidBlocks(document, render);

    expect(count).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].source).toBe('flowchart LR\n  A["输入"] --> B["输出"]');
    expect(document.querySelector('.mermaid-diagram svg')).not.toBeNull();
    expect(document.querySelector('pre[data-language="mermaid"]')).toBeNull();
  });

  it('leaves non-Mermaid code blocks unchanged', async () => {
    document.body.innerHTML = `
      <pre data-language="python"><code>print("hello")</code></pre>
    `;
    let calls = 0;
    const render: MermaidRender = async () => {
      calls += 1;
      return { svg: '<svg></svg>' };
    };

    const count = await renderMermaidBlocks(document, render);

    expect(count).toBe(0);
    expect(calls).toBe(0);
    expect(document.querySelector('pre[data-language="python"]')?.textContent).toBe('print("hello")');
  });

  it('keeps the Mermaid source visible and explains a render failure', async () => {
    document.body.innerHTML = `
      <pre data-language="mermaid"><code>not a valid diagram</code></pre>
    `;
    let attempts = 0;
    const failingRender: MermaidRender = async () => {
      attempts += 1;
      throw new Error('private parser detail');
    };

    const firstCount = await renderMermaidBlocks(document, failingRender);
    const secondCount = await renderMermaidBlocks(document, failingRender);

    expect(firstCount).toBe(0);
    expect(secondCount).toBe(0);
    expect(attempts).toBe(1);
    expect(document.querySelector('pre[data-language="mermaid"]')?.textContent).toContain(
      'not a valid diagram',
    );
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      '图表渲染失败，已保留 Mermaid 源码。',
    );
    expect(document.body.textContent).not.toContain('private parser detail');
  });

  it('labels a diagram with the nearest preceding section heading', () => {
    document.body.innerHTML = `
      <article>
        <h2>先理解 MCP 到底是什么</h2>
        <p>章节介绍。</p>
        <pre data-language="mermaid"><code>flowchart LR</code></pre>
      </article>
    `;
    const block = document.querySelector('pre')!;

    expect(getMermaidLabel(block)).toBe('先理解 MCP 到底是什么示意图');
  });
});
