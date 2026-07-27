// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createMermaidInitializer, type MermaidApi } from './mermaid-diagrams';

function createApi() {
  const initializedWith: Array<Record<string, unknown>> = [];
  const renderedSources: string[] = [];
  const api: MermaidApi = {
    initialize(config) {
      initializedWith.push(config);
    },
    async render(_id, source) {
      renderedSources.push(source);
      return {
        svg: `<svg viewBox="0 0 640 320"><title>${source}</title></svg>`,
      };
    },
  };
  return { api, initializedWith, renderedSources };
}

describe('createMermaidInitializer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not load Mermaid on a page without diagrams', async () => {
    let loadCalls = 0;
    const { api } = createApi();
    const initialize = createMermaidInitializer(async () => {
      loadCalls += 1;
      return { default: api };
    });

    const count = await initialize(document);

    expect(count).toBe(0);
    expect(loadCalls).toBe(0);
  });

  it('loads and configures Mermaid once for every diagram on the page', async () => {
    document.body.innerHTML = `
      <pre data-language="mermaid"><code>flowchart LR
  A --> B</code></pre>
      <pre data-language="mermaid"><code>sequenceDiagram
  A->>B: hello</code></pre>
    `;
    let loadCalls = 0;
    const { api, initializedWith, renderedSources } = createApi();
    const initialize = createMermaidInitializer(async () => {
      loadCalls += 1;
      return { default: api };
    });

    const count = await initialize(document);

    expect(count).toBe(2);
    expect(loadCalls).toBe(1);
    expect(initializedWith).toHaveLength(1);
    expect(initializedWith[0]).toMatchObject({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
    });
    expect(renderedSources).toEqual(['flowchart LR\n  A --> B', 'sequenceDiagram\n  A->>B: hello']);
    expect(document.querySelectorAll('.mermaid-diagram svg')).toHaveLength(2);
  });

  it('coalesces overlapping lifecycle events into one render', async () => {
    document.body.innerHTML = `
      <pre data-language="mermaid"><code>flowchart LR
  A --> B</code></pre>
    `;
    let loadCalls = 0;
    const { api, renderedSources } = createApi();
    const initialize = createMermaidInitializer(async () => {
      loadCalls += 1;
      return { default: api };
    });

    const firstRun = initialize(document);
    const concurrentRun = initialize(document);
    const counts = await Promise.all([firstRun, concurrentRun]);

    expect(counts).toEqual([1, 1]);
    expect(loadCalls).toBe(1);
    expect(renderedSources).toHaveLength(1);
    expect(document.querySelectorAll('.mermaid-diagram')).toHaveLength(1);
  });
});
