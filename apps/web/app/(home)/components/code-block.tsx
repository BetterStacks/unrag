type Token = {
  type: 'keyword' | 'function' | 'string' | 'number' | 'comment' | 'text';
  value: string;
};

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Check for comments first (highest priority)
    const commentMatch = remaining.match(/^(\/\/.*)/);
    if (commentMatch) {
      tokens.push({ type: 'comment', value: commentMatch[1] });
      remaining = remaining.slice(commentMatch[1].length);
      continue;
    }

    // Check for strings (double quotes)
    const doubleStringMatch = remaining.match(/^("[^"]*")/);
    if (doubleStringMatch) {
      tokens.push({ type: 'string', value: doubleStringMatch[1] });
      remaining = remaining.slice(doubleStringMatch[1].length);
      continue;
    }

    // Check for strings (single quotes)
    const singleStringMatch = remaining.match(/^('[^']*')/);
    if (singleStringMatch) {
      tokens.push({ type: 'string', value: singleStringMatch[1] });
      remaining = remaining.slice(singleStringMatch[1].length);
      continue;
    }

    // Check for keywords
    const keywordMatch = remaining.match(/^(import|from|const|await|async|export)\b/);
    if (keywordMatch) {
      tokens.push({ type: 'keyword', value: keywordMatch[1] });
      remaining = remaining.slice(keywordMatch[1].length);
      continue;
    }

    // Check for known function names
    const functionMatch = remaining.match(/^(createUnragEngine|ingest|retrieve|log)\b/);
    if (functionMatch) {
      tokens.push({ type: 'function', value: functionMatch[1] });
      remaining = remaining.slice(functionMatch[1].length);
      continue;
    }

    // Check for numbers
    const numberMatch = remaining.match(/^(\d+)\b/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: numberMatch[1] });
      remaining = remaining.slice(numberMatch[1].length);
      continue;
    }

    // Take one character as plain text
    // But try to batch consecutive non-special characters
    const textMatch = remaining.match(/^([^"'\/\d\w]+|[a-zA-Z_]\w*)/);
    if (textMatch) {
      tokens.push({ type: 'text', value: textMatch[1] });
      remaining = remaining.slice(textMatch[1].length);
      continue;
    }

    // Fallback: take single character
    tokens.push({ type: 'text', value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

const tokenColors: Record<Token['type'], string> = {
  keyword: 'text-[#c586c0]',
  function: 'text-[#dcdcaa]',
  string: 'text-[#ce9178]',
  number: 'text-[#b5cea8]',
  comment: 'text-[var(--color-fd-muted-foreground)]',
  text: '',
};

function HighlightedLine({ line }: { line: string }) {
  const tokens = tokenize(line);

  return (
    <>
      {tokens.map((token, i) => {
        const colorClass = tokenColors[token.type];
        if (colorClass) {
          return (
            <span key={i} className={colorClass}>
              {token.value}
            </span>
          );
        }
        return <span key={i}>{token.value}</span>;
      })}
    </>
  );
}

export function CodeBlock({ code, highlight }: { code: string; highlight?: number[] }) {
  const lines = code.split('\n');
  return (
    <pre className="text-sm leading-relaxed overflow-x-auto text-left">
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            highlight?.includes(i)
              ? 'bg-[var(--unrag-green-500,hsl(89,31%,54%))]/10 -mx-4 px-4'
              : ''
          }
        >
          <span className="text-[var(--color-fd-muted-foreground)] select-none w-6 inline-block text-right mr-4">
            {i + 1}
          </span>
          <HighlightedLine line={line} />
        </div>
      ))}
    </pre>
  );
}
