function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-200">$1</strong>')
    .replace(/__(.+?)__/g, '<strong class="font-semibold text-slate-200">$1</strong>');
}

/** Titres, gras et listes simples — sans HTML brut. */
export function renderLightMarkdown(text: string): string {
  if (!text?.trim()) return '';

  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    const h1 = trimmed.match(/^# (.+)$/);
    const h2 = trimmed.match(/^## (.+)$/);
    const h3 = trimmed.match(/^### (.+)$/);
    const li = trimmed.match(/^[-*] (.+)$/);

    if (h1 || h2 || h3 || li || trimmed === '') {
      closeList();
    }

    if (h1) {
      out.push(`<h2 class="text-xl font-semibold text-slate-50 mt-4 mb-2">${inlineMarkdown(h1[1])}</h2>`);
      continue;
    }
    if (h2) {
      out.push(`<h3 class="text-lg font-semibold text-slate-100 mt-3 mb-1">${inlineMarkdown(h2[1])}</h3>`);
      continue;
    }
    if (h3) {
      out.push(`<h4 class="text-base font-semibold text-slate-200 mt-2 mb-1">${inlineMarkdown(h3[1])}</h4>`);
      continue;
    }
    if (li) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 my-2 space-y-1">');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(li[1])}</li>`);
      continue;
    }
    if (trimmed === '') {
      out.push('<br/>');
      continue;
    }
    out.push(`<p class="my-1">${inlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return out.join('');
}
