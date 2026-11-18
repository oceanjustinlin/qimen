// 繁体展示层转换器（i18n spec T1.2 / §5.3）。
//
// zh-TW 下把 root 里所有文本节点与 placeholder / title / aria-label / alt 属性从简体转成繁体，
// 之后用 MutationObserver 跟踪变化（流式写入的 LLM 正文、v-html 结果卡、抽屉、弹层都会被覆盖）。
//
// 规则：
// - 跳过 [data-i18n-skip] 子树、script、style、textarea、input、[contenteditable]（用户自己写的内容放在 data-i18n-skip 里）。
// - 每个节点记住「上次写入的值」，节点当前值等于记录值时跳过，避免自己触发的变更再被处理。
// - 离开繁体时 stop() 把本转换器写过、且之后没被别人改过的节点恢复成原文（不做反向转换，也不需要整页重渲染）。

export const CONVERTED_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'TEMPLATE']);
const SKIP_SELECTOR = '[data-i18n-skip], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

// 纯函数：元素（含祖先）是否在跳过范围内。只依赖 tagName / closest，便于测试。
export function isSkippedElement(el) {
  if (!el) return false;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (typeof el.closest === 'function') {
    if (el.closest(SKIP_SELECTOR)) return true;
    // 祖先是 textarea/script/style 的情况（文本节点的 parentElement 本身就是它们，已在上面判断）
  }
  return false;
}

// 纯函数：给定当前值与上次写入值，决定要不要写、写什么。返回 null 表示不动。
export function decideWrite(current, lastWritten, convert) {
  if (typeof current !== 'string' || !current) return null;
  if (lastWritten !== undefined && current === lastWritten) return null;
  const next = convert(current);
  if (next === current) return null;
  return next;
}

export function startHantDom(root, convert) {
  if (!root || typeof convert !== 'function') return () => {};
  const doc = root.ownerDocument || globalThis.document;
  const lastText = new WeakMap();
  const lastAttr = new WeakMap();
  // 写过的节点 → 写入前的原文，stop() 时据此恢复简体（不需要整页重渲染，界面状态不丢）
  const originalText = new Map();
  const originalAttr = new Map();
  let stopped = false;

  let pruneAt = 4000;
  const prune = () => {
    if (originalText.size + originalAttr.size < pruneAt) return;
    for (const node of originalText.keys()) if (!node.isConnected) originalText.delete(node);
    for (const el of originalAttr.keys()) if (!el.isConnected) originalAttr.delete(el);
    pruneAt = Math.max(4000, (originalText.size + originalAttr.size) * 2);
  };

  const handleText = (node) => {
    if (isSkippedElement(node.parentElement)) return;
    const next = decideWrite(node.nodeValue, lastText.get(node), convert);
    if (next === null) {
      lastText.set(node, node.nodeValue);
      return;
    }
    lastText.set(node, next);
    originalText.set(node, node.nodeValue);
    node.nodeValue = next;
  };

  const handleAttr = (el, name) => {
    const value = el.getAttribute(name);
    if (value == null) return;
    if (isSkippedElement(el)) {
      // input/textarea 自身的 placeholder 仍要转（值不转）
      if (!(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') || el.closest?.('[data-i18n-skip]')) return;
    }
    let record = lastAttr.get(el);
    if (!record) { record = {}; lastAttr.set(el, record); }
    const next = decideWrite(value, record[name], convert);
    if (next === null) { record[name] = value; return; }
    record[name] = next;
    let originals = originalAttr.get(el);
    if (!originals) { originals = {}; originalAttr.set(el, originals); }
    originals[name] = value;
    el.setAttribute(name, next);
  };

  const handleElementAttrs = (el) => {
    for (const name of CONVERTED_ATTRIBUTES) {
      if (el.hasAttribute?.(name)) handleAttr(el, name);
    }
  };

  const walk = (start) => {
    if (start.nodeType === TEXT_NODE) { handleText(start); return; }
    if (start.nodeType !== ELEMENT_NODE && start.nodeType !== 11) return;
    if (start.nodeType === ELEMENT_NODE) {
      handleElementAttrs(start);
      if (start.matches?.(SKIP_SELECTOR) || (SKIP_TAGS.has(start.tagName) && start.tagName !== 'INPUT' && start.tagName !== 'TEXTAREA')) return;
    }
    const walker = doc.createTreeWalker(start, 0x1 | 0x4, {
      acceptNode(node) {
        if (node.nodeType === ELEMENT_NODE) {
          if (node.matches?.('[data-i18n-skip]')) return 2; // FILTER_REJECT：整棵子树跳过
          return 1;
        }
        return 1;
      },
    });
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === TEXT_NODE) handleText(node);
      else handleElementAttrs(node);
      node = walker.nextNode();
    }
  };

  walk(root);

  const Observer = (doc.defaultView || globalThis).MutationObserver;
  const restore = () => {
    for (const [node, original] of originalText) {
      if (node.nodeValue === lastText.get(node)) node.nodeValue = original;
    }
    for (const [el, originals] of originalAttr) {
      const record = lastAttr.get(el) || {};
      for (const [name, original] of Object.entries(originals)) {
        if (el.getAttribute(name) === record[name]) el.setAttribute(name, original);
      }
    }
    originalText.clear();
    originalAttr.clear();
  };

  if (!Observer) return () => { stopped = true; restore(); };

  const observer = new Observer((records) => {
    if (stopped) return;
    prune();
    for (const rec of records) {
      if (rec.type === 'characterData') {
        handleText(rec.target);
      } else if (rec.type === 'attributes') {
        if (rec.target.nodeType === ELEMENT_NODE) handleAttr(rec.target, rec.attributeName);
      } else if (rec.type === 'childList') {
        rec.addedNodes.forEach((n) => {
          if (n.nodeType === TEXT_NODE) handleText(n);
          else if (n.nodeType === ELEMENT_NODE && !isSkippedElement(n.parentElement)) walk(n);
          else if (n.nodeType === ELEMENT_NODE && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA')) handleElementAttrs(n);
        });
      }
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: CONVERTED_ATTRIBUTES,
  });

  return () => {
    stopped = true;
    observer.disconnect();
    restore();
  };
}
