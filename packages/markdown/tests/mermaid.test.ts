import { describe, expect, it, vi } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';

import { MermaidView, createMermaidPlugin } from '../src/editor/plugins/mermaid';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeNode(attrs: Record<string, unknown>, textContent = 'graph TD; A-->B'): PMNode {
  return {
    type: { name: 'code_block' },
    attrs,
    textContent,
  } as unknown as PMNode;
}

describe('@collaflow/markdown/mermaid', () => {
  it('mermaid 块应渲染图表容器且不提供 contentDOM', async () => {
    const render = vi.fn(async () => ({ svg: '<svg>mock</svg>' }));
    const view = new MermaidView(makeNode({ language: 'mermaid' }), {} as never, () => 0, render);

    expect(view.dom.className).toContain('colla-code-block--mermaid');
    expect(view.contentDOM).toBeUndefined();
    const container = view.dom.querySelector('.colla-mermaid');
    expect(container).not.toBeNull();

    await wait(5);
    expect(render).toHaveBeenCalledWith('graph TD; A-->B', expect.any(String));
    expect(container!.innerHTML).toBe('<svg>mock</svg>');
  });

  it('非 mermaid 块应提供可编辑 contentDOM', () => {
    const view = new MermaidView(makeNode({ language: 'js' }), {} as never, () => 0);
    expect(view.contentDOM).toBeDefined();
    expect(view.contentDOM?.tagName).toBe('CODE');
    expect(view.dom.className).toBe('colla-code-block');
  });

  it('代码变化时 update 应触发重新渲染', async () => {
    const render = vi.fn(async () => ({ svg: '<svg>mock</svg>' }));
    const view = new MermaidView(makeNode({ language: 'mermaid' }), {} as never, () => 0, render);
    await wait(5);
    expect(render).toHaveBeenCalledTimes(1);

    const updated = makeNode({ language: 'mermaid' }, 'graph LR; C-->D');
    expect(view.update(updated)).toBe(true);
    await wait(5);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenLastCalledWith('graph LR; C-->D', expect.any(String));
  });

  it('语言切换（mermaid ↔ 普通）应要求重建节点视图', () => {
    const view = new MermaidView(makeNode({ language: 'mermaid' }), {} as never, () => 0);
    expect(view.update(makeNode({ language: 'js' }))).toBe(false);
    const view2 = new MermaidView(makeNode({ language: 'js' }), {} as never, () => 0);
    expect(view2.update(makeNode({ language: 'mermaid' }))).toBe(false);
  });

  it('渲染失败应显示错误信息而非崩溃', async () => {
    const render = vi.fn(async () => {
      throw new Error('bad syntax');
    });
    const view = new MermaidView(makeNode({ language: 'mermaid' }), {} as never, () => 0, render);
    const container = view.dom.querySelector('.colla-mermaid') as HTMLElement;
    await wait(5);
    expect(container.classList.contains('colla-mermaid--error')).toBe(true);
    expect(container.textContent).toContain('bad syntax');
  });

  it('createMermaidPlugin 应返回可用插件（不触发真实 mermaid 加载）', () => {
    const plugin = createMermaidPlugin();
    expect(plugin).toBeDefined();
    const withRender = createMermaidPlugin({ render: async () => ({ svg: '' }) });
    expect(withRender).toBeDefined();
  });
});
