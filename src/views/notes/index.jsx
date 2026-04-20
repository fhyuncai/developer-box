import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  App as AntdApp,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Space,
  Typography,
  Tooltip
} from 'antd';
import {
  BoldOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  PictureOutlined,
  PlusOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  CopyOutlined
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import './index.scss';

marked.setOptions({ breaks: true, gfm: true });

function formatNoteTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSummary(raw = '') {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, ' 图片 ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function toFileUrl(storagePath, relativePath) {
  if (!storagePath || !relativePath) return relativePath;
  const normalizedBase = storagePath.replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedRelative = relativePath.replace(/\\/g, '/').replace(/^\//, '');
  return encodeURI(`file://${normalizedBase}/${normalizedRelative}`);
}

function toRelativePath(storagePath, source) {
  if (!source) return '';
  const normalizedBase = String(storagePath || '').replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedSource = decodeURI(String(source).replace(/^file:\/\//, '')).replace(/\\/g, '/');
  if (normalizedBase && normalizedSource.startsWith(`${normalizedBase}/`)) {
    return normalizedSource.slice(normalizedBase.length + 1);
  }
  return source;
}

function createTodoRowMarkup(contentHtml = '待办事项', checked = false) {
  return `<div class="note-todo-row" data-checked="${checked ? 'true' : 'false'}"><span class="ant-checkbox note-todo-box${checked ? ' ant-checkbox-checked' : ''}" contenteditable="false" role="checkbox" aria-checked="${checked ? 'true' : 'false'}"><span class="ant-checkbox-inner"></span></span><span class="note-todo-text">${contentHtml || '<br>'}</span></div>`;
}

function createTodoRowElement(contentHtml = '待办事项', checked = false) {
  const row = document.createElement('div');
  row.className = 'note-todo-row';
  row.setAttribute('data-checked', checked ? 'true' : 'false');
  row.innerHTML = `<span class="ant-checkbox note-todo-box${checked ? ' ant-checkbox-checked' : ''}" contenteditable="false" role="checkbox" aria-checked="${checked ? 'true' : 'false'}"><span class="ant-checkbox-inner"></span></span><span class="note-todo-text">${contentHtml || '<br>'}</span>`;
  return row;
}

function markdownToEditorHtml(markdown, storagePath) {
  const rawHtml = String(marked.parse(markdown || '') || '')
    .replace(/<input([^>]*?)checked=""([^>]*?)>/g, '<input$1 checked$2>')
    .replace(/\sdisabled(?:="")?/g, '');
  if (!rawHtml.trim()) return '';

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div id="note-html-root">${rawHtml}</div>`, 'text/html');
  const root = documentNode.getElementById('note-html-root');
  if (!root) return '';

  Array.from(root.querySelectorAll('ul')).forEach((list) => {
    const items = Array.from(list.children || []);
    const isTodoList = items.length > 0 && items.every((item) => item.querySelector(':scope > input[type="checkbox"]'));
    if (!isTodoList) return;

    const fragment = documentNode.createDocumentFragment();
    items.forEach((item) => {
      const checkbox = item.querySelector(':scope > input[type="checkbox"]');
      const checked = !!(checkbox?.checked || checkbox?.hasAttribute('checked'));
      checkbox?.remove();
      const wrapper = documentNode.createElement('div');
      wrapper.innerHTML = createTodoRowMarkup(item.innerHTML.trim() || '待办事项', checked);
      if (wrapper.firstElementChild) {
        fragment.appendChild(wrapper.firstElementChild);
      }
    });
    list.replaceWith(fragment);
  });

  const normalizedHtml = root.innerHTML.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/g, (_, before, src, after) => {
    const relativePath = src.startsWith('note_images/') ? src : toRelativePath(storagePath, src);
    const finalSrc = relativePath.startsWith('note_images/') ? toFileUrl(storagePath, relativePath) : src;
    return `<img${before} src="${finalSrc}" data-relative-path="${relativePath}"${after}>`;
  });

  return normalizedHtml;
}

function inlineNodeToMarkdown(node, storagePath) {
  if (node.nodeType === Node.TEXT_NODE) {
    return String(node.textContent || '').replace(/\u00a0/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const tag = node.tagName.toLowerCase();
  const children = () => Array.from(node.childNodes).map((child) => inlineNodeToMarkdown(child, storagePath)).join('');

  switch (tag) {
    case 'strong':
    case 'b':
      return `**${children()}**`;
    case 'em':
    case 'i':
      return `*${children()}*`;
    case 'u':
      return `<u>${children()}</u>`;
    case 'br':
      return '\n';
    case 'code':
      return `\`${children().trim()}\``;
    case 'img': {
      const alt = node.getAttribute('alt') || 'image';
      const relativePath = node.getAttribute('data-relative-path') || toRelativePath(storagePath, node.getAttribute('src') || '');
      return `![${alt}](${relativePath})`;
    }
    case 'input':
      if ((node.getAttribute('type') || '').toLowerCase() === 'checkbox') {
        return node.checked || node.hasAttribute('checked') ? '[x] ' : '[ ] ';
      }
      return '';
    default:
      return children();
  }
}

function blockNodeToMarkdown(node, storagePath) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = String(node.textContent || '').trim();
    return text ? `${text}\n\n` : '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const tag = node.tagName.toLowerCase();
  const inline = () => Array.from(node.childNodes).map((child) => inlineNodeToMarkdown(child, storagePath)).join('').trim();

  switch (tag) {
    case 'h1':
      return `# ${inline()}\n\n`;
    case 'h2':
      return `## ${inline()}\n\n`;
    case 'h3':
      return `### ${inline()}\n\n`;
    case 'blockquote': {
      const text = inline();
      return text ? `${text.split('\n').map((line) => `> ${line}`).join('\n')}\n\n` : '';
    }
    case 'ol':
      return `${Array.from(node.children).map((item, index) => `${index + 1}. ${inlineNodeToMarkdown(item, storagePath).trim()}`).join('\n')}\n\n`;
    case 'ul':
      return `${Array.from(node.children).map((item) => `- ${inlineNodeToMarkdown(item, storagePath).trim()}`).join('\n')}\n\n`;
    case 'p':
    case 'div': {
      if (node.classList?.contains('note-todo-row')) {
        const checked = node.getAttribute('data-checked') === 'true';
        const textNode = node.querySelector('.note-todo-text');
        const text = textNode
          ? Array.from(textNode.childNodes).map((child) => inlineNodeToMarkdown(child, storagePath)).join('').trim()
          : '';
        return `- [${checked ? 'x' : ' '}] ${text}`.trimEnd() + '\n\n';
      }
      const hasBlockChildren = Array.from(node.children).some((child) => ['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'blockquote'].includes(child.tagName.toLowerCase()));
      if (hasBlockChildren) {
        return Array.from(node.childNodes).map((child) => blockNodeToMarkdown(child, storagePath)).join('');
      }
      const text = inline();
      return text ? `${text}\n\n` : '';
    }
    case 'img':
      return `${inlineNodeToMarkdown(node, storagePath)}\n\n`;
    default:
      return inline() ? `${inline()}\n\n` : '';
  }
}

function htmlToMarkdown(html, storagePath) {
  if (!html) return '';
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div id="note-root">${html}</div>`, 'text/html');
  const root = documentNode.getElementById('note-root');
  if (!root) return '';
  return Array.from(root.childNodes)
    .map((node) => blockNodeToMarkdown(node, storagePath))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const DEFAULT_FORMAT_STATE = {
  block: 'p',
  bold: false,
  italic: false,
  underline: false,
  orderedList: false,
  unorderedList: false,
  todo: false,
};

export default function NotesPage({ initialNotes = [], onNotesChange, onBack, onBackHome }) {
  const { message, modal } = AntdApp.useApp();
  const editorRef = useRef(null);
  const saveTimerRef = useRef(null);
  const suppressSaveRef = useRef(true);
  const [storagePath, setStoragePath] = useState('');
  const [notes, setNotes] = useState(initialNotes);
  const [selectedId, setSelectedId] = useState(initialNotes[0]?.id || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formatState, setFormatState] = useState(DEFAULT_FORMAT_STATE);
  const [visibleCharCount, setVisibleCharCount] = useState(0);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);

  useEffect(() => {
    window.developerBox.getStoragePath().then(setStoragePath).catch(() => setStoragePath(''));
  }, []);

  useEffect(() => {
    setNotes(initialNotes);
    if (!selectedId && initialNotes[0]?.id) {
      setSelectedId(initialNotes[0].id);
    }
  }, [initialNotes, selectedId]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const filteredNotes = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return notes;
    return notes.filter((item) => {
      const haystack = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
  }, [keyword, notes]);

  const normalizeEditorIfEmpty = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const html = String(editor.innerHTML || '')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/gi, '')
      .replace(/\s+/g, '')
      .trim();

    const visibleText = String(editor.innerText || editor.textContent || '')
      .replace(/\u200B/g, '')
      .replace(/\r/g, '')
      .replace(/\n/g, '')
      .trim();

    const hasNonTextContent = !!editor.querySelector('img,.note-todo-row');
    if (!hasNonTextContent && (!html || visibleText.length === 0)) {
      editor.innerHTML = '';
    }
  };

  const updateEditorMetrics = () => {
    const editor = editorRef.current;
    if (!editor) {
      setVisibleCharCount(0);
      setIsEditorEmpty(true);
      return;
    }

    normalizeEditorIfEmpty();

    const visibleText = String(editor.innerText || editor.textContent || '')
      .replace(/\u200B/g, '')
      .replace(/\r/g, '')
      .replace(/\n/g, '');
    const hasNonTextContent = !!editor.querySelector('img,.note-todo-row');
    setVisibleCharCount(visibleText.length);
    setIsEditorEmpty(!hasNonTextContent && visibleText.length === 0);
  };

  const syncNotes = (updater) => {
    setNotes((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onNotesChange?.(next);
      return next;
    });
  };

  const refreshNotes = async (preferredId = '') => {
    const list = await window.developerBox.listNotes();
    setNotes(list);
    onNotesChange?.(list);
    setSelectedId((current) => {
      if (preferredId) return preferredId;
      if (list.some((item) => item.id === current)) return current;
      return list[0]?.id || '';
    });
    return list;
  };

  const loadNote = async (noteId) => {
    if (!noteId) {
      suppressSaveRef.current = true;
      setTitle('');
      setContent('');
      setVisibleCharCount(0);
      setIsEditorEmpty(true);
      if (editorRef.current) editorRef.current.innerHTML = '';
      return;
    }

    setLoading(true);
    try {
      const note = await window.developerBox.getNote(noteId);
      const nextTitle = !note?.title || note.title === '无标题笔记' ? '' : note.title;
      const nextContent = note?.content || '';
      suppressSaveRef.current = true;
      setTitle(nextTitle);
      setContent(nextContent);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = nextContent ? markdownToEditorHtml(nextContent, storagePath) : '';
          updateEditorMetrics();
        }
      });
    } catch (error) {
      message.error(error?.message || '读取笔记失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNote(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !editorRef.current || document.activeElement === editorRef.current) return;
    editorRef.current.innerHTML = content ? markdownToEditorHtml(content, storagePath) : '';
    updateEditorMetrics();
  }, [storagePath, selectedId]);

  const updateFormatState = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    let element = null;
    if (selection?.rangeCount) {
      const anchorNode = selection.anchorNode;
      if (anchorNode?.nodeType === Node.TEXT_NODE) {
        element = anchorNode.parentElement;
      } else if (anchorNode instanceof Element) {
        element = anchorNode;
      }
    }

    const activeElement = document.activeElement;
    const insideEditor = (element && editor.contains(element)) || (activeElement && editor.contains(activeElement));
    if (!insideEditor) {
      setFormatState(DEFAULT_FORMAT_STATE);
      return;
    }

    const currentElement = (element && editor.contains(element) ? element : activeElement) || editor;
    let block = 'p';
    try {
      const queried = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
      if (['h1', 'h2', 'h3'].includes(queried)) {
        block = queried;
      }
    } catch {}

    if (block === 'p') {
      const blockElement = currentElement.closest?.('h1,h2,h3,p,div,li,blockquote');
      const tagName = blockElement?.tagName?.toLowerCase();
      if (['h1', 'h2', 'h3'].includes(tagName)) {
        block = tagName;
      }
    }

    const queryState = (command) => {
      try {
        return !!document.queryCommandState(command);
      } catch {
        return false;
      }
    };

    setFormatState({
      block,
      bold: queryState('bold'),
      italic: queryState('italic'),
      underline: queryState('underline'),
      orderedList: queryState('insertOrderedList'),
      unorderedList: queryState('insertUnorderedList'),
      todo: !!currentElement.closest?.('.note-todo-item, .note-todo-row'),
    });
  };

  useEffect(() => {
    document.addEventListener('selectionchange', updateFormatState);
    return () => document.removeEventListener('selectionchange', updateFormatState);
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return undefined;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const nextTitle = String(title || '').trim() || '无标题笔记';
      const nextSummary = buildSummary(content);
      const updatedAt = new Date().toISOString();
      syncNotes((prev) => [...prev]
        .map((item) => (item.id === selectedId ? { ...item, title: nextTitle, summary: nextSummary, updatedAt } : item))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      try {
        await window.developerBox.updateNote({ id: selectedId, title: nextTitle, content });
      } catch (error) {
        message.error(error?.message || '保存笔记失败');
        await refreshNotes(selectedId);
      }
    }, 350);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [selectedId, title, content]);

  const handleEditorInput = () => {
    normalizeEditorIfEmpty();
    const html = editorRef.current?.innerHTML || '';
    setContent(htmlToMarkdown(html, storagePath));
    updateEditorMetrics();
  };

  const runCommand = (command, value = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleEditorInput();
    requestAnimationFrame(updateFormatState);
  };

  const placeCursorAtEnd = (element) => {
    if (!element) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const handleInsertTodo = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
    const currentRow = anchorElement instanceof Element ? anchorElement.closest('.note-todo-row, p, div, h1, h2, h3, blockquote, li') : null;

    if (currentRow?.classList?.contains('note-todo-row')) {
      const contentHtml = currentRow.querySelector('.note-todo-text')?.innerHTML?.trim() || '<br>';
      const plainRow = document.createElement('div');
      plainRow.innerHTML = contentHtml;
      currentRow.replaceWith(plainRow);
      placeCursorAtEnd(plainRow);
      handleEditorInput();
      requestAnimationFrame(updateFormatState);
      return;
    }

    const rowText = currentRow?.innerHTML?.trim() || '待办事项';
    const todoRow = createTodoRowElement(rowText, false);

    if (currentRow && currentRow !== editor) {
      currentRow.replaceWith(todoRow);
    } else {
      editor.appendChild(todoRow);
    }

    placeCursorAtEnd(todoRow.querySelector('.note-todo-text'));
    handleEditorInput();
    requestAnimationFrame(updateFormatState);
  };

  const handleInsertHeading = (level) => {
    const normalizedLevel = String(level || '').toLowerCase();
    if (formatState.block === normalizedLevel) {
      runCommand('formatBlock', 'p');
      return;
    }
    runCommand('formatBlock', normalizedLevel);
  };

  const handleEditorClick = (event) => {
    const checkbox = event.target.closest('.note-todo-box');
    if (!checkbox) return;
    event.preventDefault();
    const row = checkbox.closest('.note-todo-row');
    const nextChecked = row?.getAttribute('data-checked') !== 'true';
    if (row) row.setAttribute('data-checked', nextChecked ? 'true' : 'false');
    checkbox.classList.toggle('ant-checkbox-checked', nextChecked);
    checkbox.setAttribute('aria-checked', nextChecked ? 'true' : 'false');
    handleEditorInput();
  };

  const handleEditorKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const anchorNode = window.getSelection()?.anchorNode;
    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
    const todoRow = anchorElement instanceof Element ? anchorElement.closest('.note-todo-row') : null;
    if (!todoRow) return;

    event.preventDefault();
    const textHtml = todoRow.querySelector('.note-todo-text')?.innerHTML?.trim() || '';

    if (!textHtml || textHtml === '<br>') {
      const plainRow = document.createElement('div');
      plainRow.innerHTML = '<br>';
      todoRow.after(plainRow);
      placeCursorAtEnd(plainRow);
    } else {
      const newTodoRow = createTodoRowElement('', false);
      todoRow.after(newTodoRow);
      placeCursorAtEnd(newTodoRow.querySelector('.note-todo-text'));
    }

    handleEditorInput();
    requestAnimationFrame(updateFormatState);
  };

  const handleEditorPaste = (event) => {
    event.preventDefault();
    const plainText = event.clipboardData?.getData('text/plain') || '';
    editorRef.current?.focus();
    document.execCommand('insertText', false, plainText);
    handleEditorInput();
    requestAnimationFrame(updateFormatState);
  };

  const handleCopyNote = async (noteId = selectedId) => {
    try {
      const note = await window.developerBox.duplicateNote(noteId);
      const list = await refreshNotes(note?.id || '');
      if (note?.id && list.some((item) => item.id === note.id)) {
        setSelectedId(note.id);
      }
      message.success('已复制为新笔记');
    } catch (error) {
      message.error(error?.message || '复制失败');
    }
  };

  const deleteNoteById = async (noteId) => {
    await window.developerBox.deleteNote(noteId);
    const list = await refreshNotes(selectedId === noteId ? '' : selectedId);
    if (selectedId === noteId && list.length === 0) {
      suppressSaveRef.current = true;
      setTitle('');
      setContent('');
      setVisibleCharCount(0);
      setIsEditorEmpty(true);
      if (editorRef.current) editorRef.current.innerHTML = '';
    }
  };

  const handleInsertImage = async () => {
    if (!selectedId) {
      message.warning('请先创建笔记');
      return;
    }
    try {
      const file = await window.developerBox.importNoteImage(selectedId);
      if (!file?.relativePath) return;
      const imageUrl = toFileUrl(storagePath, file.relativePath);
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<p><img src="${imageUrl}" data-relative-path="${file.relativePath}" alt="${file.fileName}" /></p>`);
      handleEditorInput();
      message.success('图片已插入');
    } catch (error) {
      message.error(error?.message || '插入图片失败');
    }
  };

  const handleCreateNote = async () => {
    try {
      const note = await window.developerBox.createNote({ title: '', content: '' });
      await refreshNotes(note?.id || '');
      if (note?.id) setSelectedId(note.id);
    } catch (error) {
      message.error(error?.message || '创建笔记失败');
    }
  };

  const handleDeleteNote = async (noteId = selectedId) => {
    if (!noteId) return;
    modal.confirm({
      title: '确认删除笔记？',
      content: '将不会保留任何内容',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        await deleteNoteById(noteId);
        message.success('已删除');
      },
    });
  };

  return (
    <div className="notes-page">
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <PageHeader
          items={[
            { title: '首页', onClick: onBackHome },
            { title: '笔记' },
          ]}
          onBack={onBack}
          onBackHome={onBackHome}
          className="notes-topbar"
        >
          <Tooltip title="新建笔记">
            <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={handleCreateNote} aria-label="新建笔记" />
          </Tooltip>
          <Tooltip title="复制笔记">
            <Button shape="circle" icon={<CopyOutlined />} onClick={() => handleCopyNote()} aria-label="复制笔记" />
          </Tooltip>
          <Tooltip title="删除笔记">
            <Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDeleteNote()} disabled={!selectedId} aria-label="删除笔记" />
          </Tooltip>
        </PageHeader>

        <div className="notes-shell">
          <Card className="notes-sidebar" bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Input.Search
                allowClear
                placeholder="搜索标题或内容"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              <div className="notes-list">
                {filteredNotes.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无笔记" />
                ) : (
                  filteredNotes.map((item) => (
                    <Dropdown
                      key={item.id}
                      trigger={['contextMenu']}
                      menu={{
                        items: [
                          { key: 'copy', label: '复制' },
                          { key: 'delete', label: '删除', danger: true },
                        ],
                        onClick: ({ key, domEvent }) => {
                          domEvent.stopPropagation();
                          if (key === 'copy') handleCopyNote(item.id);
                          if (key === 'delete') handleDeleteNote(item.id);
                        },
                      }}
                    >
                      <button
                        type="button"
                        className={`notes-list-item${item.id === selectedId ? ' active' : ''}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div className="notes-list-item-title">{item.title || '无标题笔记'}</div>
                        <div className="notes-list-item-summary">{item.summary || 'Markdown 笔记'}</div>
                        <div className="notes-list-item-meta">
                          <span>{formatNoteTime(item.updatedAt)}</span>
                        </div>
                      </button>
                    </Dropdown>
                  ))
                )}
              </div>
            </Space>
          </Card>

          <Card
            className="notes-editor-card"
            bodyStyle={{ padding: 0 }}
            title={selectedId ? (
              <div className="notes-card-head-content">
                <div className="notes-card-title-wrap">
                  <Input
                    size="large"
                    value={title}
                    placeholder="无标题笔记"
                    disabled={loading}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="notes-editor-toolbar-scroll">
                  <Space wrap={true} size={8}>
                    <Button shape="circle" type={formatState.todo ? 'primary' : 'default'} icon={<CheckSquareOutlined />} onClick={handleInsertTodo} title="TODO" />
                    <Button type={formatState.block === 'h1' ? 'primary' : 'default'} onClick={() => handleInsertHeading('h1')}>H1</Button>
                    <Button type={formatState.block === 'h2' ? 'primary' : 'default'} onClick={() => handleInsertHeading('h2')}>H2</Button>
                    <Button type={formatState.block === 'h3' ? 'primary' : 'default'} onClick={() => handleInsertHeading('h3')}>H3</Button>
                    <Button shape="circle" type={formatState.bold ? 'primary' : 'default'} icon={<BoldOutlined />} onClick={() => runCommand('bold')} title="加粗" />
                    <Button shape="circle" type={formatState.italic ? 'primary' : 'default'} icon={<ItalicOutlined />} onClick={() => runCommand('italic')} title="斜体" />
                    <Button shape="circle" type={formatState.underline ? 'primary' : 'default'} icon={<UnderlineOutlined />} onClick={() => runCommand('underline')} title="下划线" />
                    <Button shape="circle" type={formatState.orderedList ? 'primary' : 'default'} icon={<OrderedListOutlined />} onClick={() => runCommand('insertOrderedList')} title="有序列表" />
                    <Button shape="circle" type={formatState.unorderedList ? 'primary' : 'default'} icon={<UnorderedListOutlined />} onClick={() => runCommand('insertUnorderedList')} title="无序列表" />
                    <Button shape="circle" icon={<PictureOutlined />} onClick={handleInsertImage} title="图片" />
                  </Space>
                </div>
              </div>) : null
            }
          >
            {selectedId ? (
              <div className="notes-editor-layout">
                <div className="notes-native-surface">
                  <div
                    ref={editorRef}
                    className="notes-rich-editor"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="开始记录你的想法…"
                    data-empty={isEditorEmpty}
                    onInput={handleEditorInput}
                    onClick={handleEditorClick}
                    onPaste={handleEditorPaste}
                    onKeyDown={handleEditorKeyDown}
                    onKeyUp={updateFormatState}
                    onMouseUp={updateFormatState}
                    onFocus={updateFormatState}
                    onBlur={handleEditorInput}
                  />
                </div>

                <div className="notes-footer-meta">
                  <span></span>
                  <span>{visibleCharCount} 字符</span>
                </div>
              </div>
            ) : (
              <div className="notes-empty-state">
                <Empty description="创建第一条笔记开始记录" />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNote}>新建笔记</Button>
              </div>
            )}
          </Card>
        </div>
      </Space>
    </div>
  );
}
