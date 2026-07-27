export interface MermaidRenderResult {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

export type MermaidRender = (id: string, source: string) => Promise<MermaidRenderResult>;

const MERMAID_SELECTOR = 'pre[data-language="mermaid"]:not([data-mermaid-state])';
let diagramId = 0;

export function findMermaidBlocks(root: ParentNode): HTMLPreElement[] {
  return Array.from(root.querySelectorAll<HTMLPreElement>(MERMAID_SELECTOR));
}

export function getMermaidLabel(block: Element): string {
  let current: Element | null = block;

  while (current) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.matches('h2, h3')) {
        const heading = sibling.textContent?.trim();
        if (heading) return `${heading}示意图`;
      }

      const nestedHeadings = sibling.querySelectorAll('h2, h3');
      const nestedHeading = nestedHeadings.item(nestedHeadings.length - 1);
      const nestedText = nestedHeading?.textContent?.trim();
      if (nestedText) return `${nestedText}示意图`;

      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return '文章示意图';
}

export async function renderMermaidBlocks(
  root: ParentNode,
  render: MermaidRender,
): Promise<number> {
  const blocks = findMermaidBlocks(root);
  let rendered = 0;

  for (const block of blocks) {
    block.dataset.mermaidState = 'pending';
    const source = block.textContent?.trim() ?? '';

    try {
      const result = await render(`mermaid-diagram-${diagramId++}`, source);
      const figure = block.ownerDocument.createElement('figure');
      figure.className = 'mermaid-diagram';
      figure.setAttribute('role', 'img');
      figure.setAttribute('aria-label', getMermaidLabel(block));
      figure.innerHTML = `<div class="mermaid-diagram__canvas">${result.svg}</div>`;
      block.replaceWith(figure);
      result.bindFunctions?.(figure);
      rendered += 1;
    } catch {
      block.dataset.mermaidState = 'error';
      const notice = block.ownerDocument.createElement('p');
      notice.className = 'mermaid-diagram-error';
      notice.setAttribute('role', 'alert');
      notice.textContent = '图表渲染失败，已保留 Mermaid 源码。';
      block.insertAdjacentElement('afterend', notice);
    }
  }

  return rendered;
}
