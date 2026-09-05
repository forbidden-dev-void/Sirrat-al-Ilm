/**
 * Minimal, safe Markdown renderer
 * ===============================
 *
 * The blog body and lab descriptions are Markdown. Rather than pulling in a
 * parser + sanitiser (and risking `dangerouslySetInnerHTML`), this module
 * converts a practical subset straight into React elements:
 *
 *   # / ## / ###  headings        - / * / 1.  lists
 *   >             blockquote      ``` fenced code
 *   **bold**  *italic*  `code`  [text](url)
 *
 * Because output is React elements, user content can never inject markup.
 */

import { Fragment, type ReactNode } from 'react';

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(INLINE_PATTERN);

  parts.forEach((part, index) => {
    if (!part) return;
    const key = `${keyPrefix}-${index}`;

    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
      return;
    }
    if (/^\*[^*\n]+\*$/.test(part)) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>);
      return;
    }
    if (/^`[^`]+`$/.test(part)) {
      nodes.push(
        <code key={key} className="inline-code">
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    const link = part.match(LINK_PATTERN);
    if (link) {
      const [, label, href] = link;
      const external = /^https?:\/\//i.test(href);
      nodes.push(
        <a
          key={key}
          href={href}
          className="prose-link"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
          {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
        </a>,
      );
      return;
    }
    nodes.push(<Fragment key={key}>{part}</Fragment>);
  });

  return nodes;
}

interface Block {
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code';
  level?: number;
  ordered?: boolean;
  items?: string[];
  text?: string;
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let index = 0;

  const flushParagraph = (): void => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
      list = null;
    }
  };
  const flushQuote = (): void => {
    if (quote.length) {
      blocks.push({ type: 'quote', text: quote.join(' ') });
      quote = [];
    }
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    // Fenced code block ------------------------------------------------------
    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      flushQuote();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1; // skip the closing fence
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push({ type: 'heading', level: Math.min(4, heading[1].length), text: heading[2] });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ''));
      index += 1;
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.*)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    const bullet = unordered ?? ordered;
    if (bullet) {
      flushParagraph();
      flushQuote();
      const isOrdered = Boolean(ordered);
      const content = bullet[1] ?? '';
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(content);
      index += 1;
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  flushList();
  flushQuote();
  return blocks;
}

/** Convert Markdown source into React nodes (never raw HTML). */
export function renderMarkdown(source: string | null | undefined): ReactNode[] {
  if (!source) return [];
  return parseBlocks(source).map((block, index) => {
    const key = `block-${index}`;
    switch (block.type) {
      case 'heading': {
        const content = renderInline(block.text ?? '', key);
        if (block.level === 1) return <h2 key={key}>{content}</h2>;
        if (block.level === 2) return <h3 key={key}>{content}</h3>;
        return <h4 key={key}>{content}</h4>;
      }
      case 'list': {
        const items = (block.items ?? []).map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
        ));
        return block.ordered ? (
          <ol key={key} className="prose-list">
            {items}
          </ol>
        ) : (
          <ul key={key} className="prose-list">
            {items}
          </ul>
        );
      }
      case 'quote':
        return (
          <blockquote key={key} className="prose-quote">
            {renderInline(block.text ?? '', key)}
          </blockquote>
        );
      case 'code':
        return (
          <pre key={key} className="prose-code">
            <code>{block.text}</code>
          </pre>
        );
      case 'paragraph':
      default:
        return <p key={key}>{renderInline(block.text ?? '', key)}</p>;
    }
  });
}
