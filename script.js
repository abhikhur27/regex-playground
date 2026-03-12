const patternInput = document.getElementById('pattern');
const sourceInput = document.getElementById('source');
const replacementInput = document.getElementById('replacement');
const runButton = document.getElementById('run');
const copyButton = document.getElementById('copy');
const copyReplaceButton = document.getElementById('copy-replace');
const saveSnippetButton = document.getElementById('save-snippet');
const sampleButton = document.getElementById('sample-email');
const snippetSelect = document.getElementById('snippet-select');
const errorEl = document.getElementById('error');
const highlightEl = document.getElementById('highlight');
const replacePreviewEl = document.getElementById('replace-preview');
const matchCountEl = document.getElementById('match-count');
const activeFlagsEl = document.getElementById('active-flags');
const matchTable = document.getElementById('match-table');
const groupsEl = document.getElementById('groups');
const patternNotesEl = document.getElementById('pattern-notes');
const SNIPPETS_KEY = 'regex_playground_snippets_v1';
let snippets = loadSnippets();

function loadSnippets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNIPPETS_KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 20);
  } catch (error) {
    return [];
  }
}

function saveSnippets() {
  localStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets.slice(0, 20)));
}

function renderSnippetSelect() {
  const options = ['<option value="">Choose a saved snippet...</option>']
    .concat(
      snippets.map(
        (snippet, index) =>
          `<option value="${index}">${escapeHtml(snippet.label)} (${escapeHtml(snippet.flags || 'none')})</option>`
      )
    )
    .join('');

  snippetSelect.innerHTML = options;
}

function getFlags() {
  return Array.from(document.querySelectorAll('.flags input:checked'))
    .map((input) => input.value)
    .join('');
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function collectMatches(regex, text, flags) {
  const output = [];
  const iterate = flags.includes('g') || flags.includes('y');

  if (!iterate) {
    const single = regex.exec(text);
    if (single) {
      output.push({
        value: single[0],
        index: single.index,
        length: single[0].length,
        groups: single.slice(1),
        namedGroups: single.groups || {},
      });
    }
    return output;
  }

  let match;
  while ((match = regex.exec(text)) !== null) {
    output.push({
      value: match[0],
      index: match.index,
      length: match[0].length,
      groups: match.slice(1),
      namedGroups: match.groups || {},
    });

    // Prevent infinite loops on zero-length matches.
    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  return output;
}

function renderHighlight(text, matches) {
  if (!matches.length) {
    highlightEl.innerHTML = escapeHtml(text);
    return;
  }

  let pointer = 0;
  let html = '';

  matches.forEach((match) => {
    const start = match.index;
    const end = start + match.length;

    html += escapeHtml(text.slice(pointer, start));
    html += `<span class="mark">${escapeHtml(text.slice(start, end))}</span>`;
    pointer = end;
  });

  html += escapeHtml(text.slice(pointer));
  highlightEl.innerHTML = html;
}

function renderReplacement(text, pattern, flags, replacement) {
  if (!pattern) {
    replacePreviewEl.innerHTML = escapeHtml(text);
    return;
  }

  try {
    const regex = new RegExp(pattern, flags);
    const replaced = text.replace(regex, replacement);
    replacePreviewEl.innerHTML = escapeHtml(replaced);
  } catch (error) {
    replacePreviewEl.innerHTML = escapeHtml(text);
  }
}

function renderTable(matches) {
  if (!matches.length) {
    matchTable.innerHTML = '<tr><td colspan="4" class="empty">No matches found.</td></tr>';
    return;
  }

  matchTable.innerHTML = matches
    .map(
      (match, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><code>${escapeHtml(match.value)}</code></td>
          <td>${match.index}</td>
          <td>${match.length}</td>
        </tr>
      `
    )
    .join('');
}

function renderGroups(matches) {
  if (!matches.length) {
    groupsEl.innerHTML = '<p class="empty">No capture groups to show.</p>';
    return;
  }

  const cards = matches.map((match, index) => {
    const positional = match.groups.length
      ? match.groups
          .map((value, groupIndex) => `<div>Group ${groupIndex + 1}: <code>${escapeHtml(String(value))}</code></div>`)
          .join('')
      : '<div>No positional groups.</div>';

    const namedEntries = Object.entries(match.namedGroups || {});
    const named = namedEntries.length
      ? `<div>Named: ${namedEntries
          .map(([name, value]) => `<code>${escapeHtml(name)}=${escapeHtml(String(value))}</code>`)
          .join(', ')}</div>`
      : '<div>No named groups.</div>';

    return `
      <article class="group-card">
        <strong>Match ${index + 1}</strong>
        <div><code>${escapeHtml(match.value)}</code></div>
        ${positional}
        ${named}
      </article>
    `;
  });

  groupsEl.innerHTML = cards.join('');
}

function renderPatternNotes(pattern, flags) {
  if (!pattern) {
    patternNotesEl.innerHTML = '<p class="empty">Enter a pattern to see an explanation.</p>';
    return;
  }

  const checks = [
    { test: /\\d/, label: 'Digit matcher', detail: '\\d matches numeric characters.' },
    { test: /\\w/, label: 'Word matcher', detail: '\\w matches letters, numbers, and underscore.' },
    { test: /\\s/, label: 'Whitespace matcher', detail: '\\s matches spaces, tabs, and line breaks.' },
    { test: /\[[^\]]+\]/, label: 'Character class', detail: '[...] matches one character from a set/range.' },
    { test: /\(\?:/, label: 'Non-capturing group', detail: '(?:...) groups without creating capture indexes.' },
    { test: /\(\?</, label: 'Named capture', detail: '(?<name>...) creates a named capture group.' },
    { test: /\(/, label: 'Capturing group', detail: '(...) captures a sub-expression.' },
    { test: /\|/, label: 'Alternation', detail: 'A|B matches either branch.' },
    { test: /\+/, label: 'One-or-more quantifier', detail: '+ repeats the previous token at least once.' },
    { test: /\*/, label: 'Zero-or-more quantifier', detail: '* repeats the previous token zero or more times.' },
    { test: /\?/, label: 'Optional or lazy marker', detail: '? often marks optional tokens or lazy quantifiers.' },
    { test: /\^/, label: 'Start anchor', detail: '^ anchors the match at the start of a line/string.' },
    { test: /\$/, label: 'End anchor', detail: '$ anchors the match at the end of a line/string.' },
  ];

  const notes = checks.filter((check) => check.test.test(pattern));
  if (flags) {
    notes.push({ label: 'Active flags', detail: `Current flags: ${flags}` });
  }

  patternNotesEl.innerHTML = notes.length
    ? notes.map((note) => `<article class="group-card"><strong>${note.label}</strong><div>${note.detail}</div></article>`).join('')
    : '<p class="empty">No common tokens detected yet. Try adding groups, classes, or anchors.</p>';
}

function runRegex() {
  const pattern = patternInput.value;
  const source = sourceInput.value;
  const flags = getFlags();
  const replacement = replacementInput.value;

  activeFlagsEl.textContent = flags || '(none)';
  errorEl.textContent = '';

  if (!pattern) {
    matchCountEl.textContent = '0';
    highlightEl.innerHTML = escapeHtml(source);
    replacePreviewEl.innerHTML = escapeHtml(source);
    matchTable.innerHTML = '<tr><td colspan="4" class="empty">Enter a pattern to begin.</td></tr>';
    groupsEl.innerHTML = '<p class="empty">No capture groups to show.</p>';
    renderPatternNotes('', flags);
    return;
  }

  try {
    const regex = new RegExp(pattern, flags);
    const matches = collectMatches(regex, source, flags);

    matchCountEl.textContent = String(matches.length);
    renderHighlight(source, matches);
    renderReplacement(source, pattern, flags, replacement);
    renderTable(matches);
    renderGroups(matches);
    renderPatternNotes(pattern, flags);
  } catch (error) {
    errorEl.textContent = `Regex error: ${error.message}`;
    matchCountEl.textContent = '0';
    highlightEl.innerHTML = escapeHtml(source);
    replacePreviewEl.innerHTML = escapeHtml(source);
    matchTable.innerHTML = '<tr><td colspan="4" class="empty">Fix the expression and run again.</td></tr>';
    groupsEl.innerHTML = '<p class="empty">No capture groups to show.</p>';
    renderPatternNotes(pattern, flags);
  }
}

function loadEmailSample() {
  patternInput.value = '(?<user>[a-z0-9._%+-]+)@(?<domain>[a-z0-9.-]+\\.[a-z]{2,})';
  sourceInput.value = 'alice@example.com\nbob.smith@company.org\ninvalid@';

  document.querySelectorAll('.flags input').forEach((input) => {
    input.checked = ['g', 'i'].includes(input.value);
  });

  runRegex();
}

runButton.addEventListener('click', runRegex);
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(`/${patternInput.value}/${getFlags()}`);
    errorEl.textContent = 'Pattern copied to clipboard.';
  } catch (error) {
    errorEl.textContent = 'Clipboard copy failed in this environment.';
  }
});
sampleButton.addEventListener('click', loadEmailSample);
copyReplaceButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(replacePreviewEl.textContent || '');
    errorEl.textContent = 'Replacement output copied.';
  } catch (error) {
    errorEl.textContent = 'Clipboard copy failed in this environment.';
  }
});
saveSnippetButton.addEventListener('click', () => {
  const pattern = patternInput.value.trim();
  if (!pattern) {
    errorEl.textContent = 'Cannot save an empty pattern.';
    return;
  }

  const flags = getFlags();
  const source = sourceInput.value;
  const timestamp = new Date().toLocaleTimeString();
  const label = pattern.length > 26 ? `${pattern.slice(0, 26)}...` : pattern;
  snippets.unshift({ label, pattern, flags, source, timestamp });
  snippets = snippets.slice(0, 20);
  saveSnippets();
  renderSnippetSelect();
  errorEl.textContent = `Saved snippet at ${timestamp}.`;
});
snippetSelect.addEventListener('change', () => {
  const index = Number(snippetSelect.value);
  if (!Number.isInteger(index) || !snippets[index]) return;

  const snippet = snippets[index];
  patternInput.value = snippet.pattern;
  sourceInput.value = snippet.source;

  document.querySelectorAll('.flags input').forEach((input) => {
    input.checked = snippet.flags.includes(input.value);
  });

  runRegex();
});

patternInput.addEventListener('input', runRegex);
sourceInput.addEventListener('input', runRegex);
replacementInput.addEventListener('input', runRegex);
document.querySelectorAll('.flags input').forEach((input) => {
  input.addEventListener('change', runRegex);
});

runRegex();
renderSnippetSelect();
