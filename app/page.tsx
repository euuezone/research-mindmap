'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ResearchNode } from '@/components/ResearchNode';
import type { ResearchNodeData } from '@/components/ResearchNode';
import { computeLayout } from '@/lib/layout';
import type { CardData } from '@/app/api/research/route';

const nodeTypes = { research: ResearchNode };

// ── 타입 ──────────────────────────────────────────────
interface Highlight {
  id: string;
  cardTitle: string;
  cardUrl: string;
  text: string;
  createdAt: string;
}

// ── 유틸 ──────────────────────────────────────────────
function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function HighlightedText({ text, marks }: { text: string; marks: string[] }) {
  if (!marks.length) return <>{text}</>;
  const escaped = marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(pattern);
  const markSet = new Set(marks);
  return (
    <>
      {parts.map((p, i) =>
        markSet.has(p) ? (
          <mark key={i} style={{ background: '#fef08a', color: '#111', borderRadius: 2, padding: '0 1px' }}>
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

async function fetchBranches(topic: string): Promise<CardData[]> {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });
  const data = (await res.json()) as { branches?: CardData[]; error?: string };
  if (data.error) throw new Error(data.error);
  return data.branches || [];
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    style: { stroke: '#2d3f60', strokeWidth: 1.5 },
  };
}

// ── 상세 패널 ─────────────────────────────────────────
function DetailPanel({
  card,
  isSelected,
  cardHighlights,
  onClose,
  onSelect,
  onAddHighlight,
  onRemoveHighlight,
}: {
  card: CardData;
  isSelected: boolean;
  cardHighlights: Highlight[];
  onClose: () => void;
  onSelect: () => void;
  onAddHighlight: (text: string) => void;
  onRemoveHighlight: (id: string) => void;
}) {
  const [extractLoading, setExtractLoading] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [extractImages, setExtractImages] = useState<string[]>([]);
  const [extractError, setExtractError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState('');

  useEffect(() => {
    if (!card.url) { setShowManualInput(true); return; }
    setRawContent('');
    setExtractImages([]);
    setExtractError('');
    setShowManualInput(false);
    setManualInput('');
    setPendingHighlight('');
    setExtractLoading(true);

    fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: card.url }),
    })
      .then((r) => r.json())
      .then((data: { rawContent?: string; images?: string[]; error?: string }) => {
        if (data.error) { setExtractError(data.error); setShowManualInput(true); return; }
        const content = data.rawContent || '';
        setRawContent(content);
        setExtractImages(data.images || []);
        if (!content) setShowManualInput(true);
      })
      .catch(() => { setExtractError('원문을 불러오지 못했습니다.'); setShowManualInput(true); })
      .finally(() => setExtractLoading(false));
  }, [card.url]);

  const handleTextMouseUp = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 1) setPendingHighlight(sel);
  };

  const handleAddHighlight = () => {
    if (!pendingHighlight) return;
    onAddHighlight(pendingHighlight);
    setPendingHighlight('');
    window.getSelection()?.removeAllRanges();
  };

  const displayContent = rawContent || (showManualInput ? '' : '');
  const markTexts = cardHighlights.map((h) => h.text);

  return (
    <div className="absolute top-0 right-0 h-full w-[380px] bg-[#0d1420] border-l border-[#1f2a3d] z-20 flex flex-col shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2a3d] flex-shrink-0">
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">상세 보기</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">

        {/* 썸네일 */}
        {card.image && (
          <div className="w-full h-[160px] overflow-hidden bg-[#111827] flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.image} alt="" className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}

        <div className="px-4 py-4 flex flex-col gap-5">

          {/* 제목·출처·날짜 */}
          <div>
            <p className="text-sm font-semibold text-white leading-snug">{card.title}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {card.source && <span className="text-[11px] text-gray-500 font-mono">{card.source}</span>}
              {card.publishedDate && (
                <span className="text-[11px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {fmtDate(card.publishedDate)}
                </span>
              )}
            </div>
          </div>

          {/* AI 요약 */}
          <div>
            <p className="text-[10px] font-mono font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">AI 요약</p>
            <p className="text-[13px] text-gray-300 leading-relaxed">{card.summary}</p>
          </div>

          {/* 원문 데이터 */}
          <div>
            <p className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider mb-2">원문 데이터</p>

            {extractLoading && (
              <div className="flex items-center gap-2 py-3 text-[12px] text-gray-500">
                <span className="inline-block h-3 w-3 rounded-full border border-gray-500 border-t-transparent animate-spin flex-shrink-0" />
                원문 크롤링 중...
              </div>
            )}

            {/* 직접 입력 */}
            {showManualInput && !extractLoading && (
              <div className="mb-3">
                {extractError && <p className="text-[11px] text-red-400 mb-2">{extractError}</p>}
                <p className="text-[11px] text-gray-500 mb-1.5">원문을 직접 붙여넣거나 입력하세요</p>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="원문 내용을 여기에 입력하세요..."
                  rows={7}
                  className="w-full rounded border border-[#2d3f60] bg-[#111827] px-3 py-2 text-[12px] text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
                />
                {manualInput && (
                  <button
                    onClick={() => setShowManualInput(false)}
                    className="mt-1.5 w-full rounded border border-indigo-500/40 py-1.5 text-[11px] text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                  >
                    저장
                  </button>
                )}
              </div>
            )}

            {/* 이미지 갤러리 */}
            {extractImages.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-gray-600 font-mono mb-1.5">이미지 ({extractImages.length})</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {extractImages.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt=""
                        className="w-full h-[80px] object-cover rounded border border-[#1f2a3d] hover:border-indigo-500 transition-colors"
                        onError={(e) => { (e.target as HTMLImageElement).closest('a')!.style.display = 'none'; }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 표시 대기 배너 */}
            {pendingHighlight && (
              <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-[#1a2030] border border-yellow-500/40 rounded px-3 py-2">
                <span className="flex-1 text-[11px] text-yellow-300 line-clamp-1">"{pendingHighlight}"</span>
                <button
                  onClick={handleAddHighlight}
                  className="text-[10px] font-mono bg-yellow-500 text-black px-2 py-1 rounded hover:bg-yellow-400 transition-colors flex-shrink-0"
                >
                  표시
                </button>
                <button onClick={() => setPendingHighlight('')} className="text-gray-500 hover:text-white text-sm flex-shrink-0">×</button>
              </div>
            )}

            {/* 원문 전체 텍스트 */}
            {(rawContent || manualInput) && !showManualInput && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[10px] text-gray-600 font-mono">원문 전체</p>
                  <p className="text-[10px] text-gray-600">· 드래그해서 표시 추가</p>
                  {rawContent && (
                    <button
                      onClick={() => setShowManualInput(true)}
                      className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      직접 편집
                    </button>
                  )}
                </div>
                <p
                  className="text-[12px] text-gray-400 leading-relaxed whitespace-pre-line select-text cursor-text"
                  onMouseUp={handleTextMouseUp}
                >
                  <HighlightedText text={rawContent || manualInput} marks={markTexts} />
                </p>
              </div>
            )}
          </div>

          {/* 내 표시 */}
          {cardHighlights.length > 0 && (
            <div>
              <p className="text-[10px] font-mono font-semibold text-yellow-500 uppercase tracking-wider mb-2">
                내 표시 ({cardHighlights.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {cardHighlights.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded px-2.5 py-2">
                    <p className="flex-1 text-[12px] text-yellow-200 leading-relaxed">{h.text}</p>
                    <button onClick={() => onRemoveHighlight(h.id)} className="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 mt-0.5">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex flex-col gap-2 px-4 py-4 border-t border-[#1f2a3d] flex-shrink-0">
        {card.url && (
          <a href={card.url} target="_blank" rel="noopener noreferrer"
            className="block w-full rounded-lg border border-[#2d3f60] py-2 text-center text-[12px] text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
            원문 바로가기 →
          </a>
        )}
        <button onClick={onSelect}
          className={`w-full rounded-lg py-2 text-[12px] font-medium transition-colors ${
            isSelected
              ? 'bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20'
              : 'bg-indigo-600 text-white hover:bg-indigo-500'
          }`}>
          {isSelected ? '✓ 선택 해제' : '선택하기'}
        </button>
      </div>
    </div>
  );
}

// ── 선택 서랍 ─────────────────────────────────────────
function SelectionDrawer({
  selected,
  onRemove,
  onClear,
}: {
  selected: CardData[];
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (selected.length === 0) return null;

  return (
    <div className="bg-[#0d1420] border border-[#1f2a3d] rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none border-b border-[#1f2a3d]"
        onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-yellow-400 font-bold">선택된 카드</span>
          <span className="rounded-full bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 leading-none">{selected.length}</span>
        </div>
        <span className="text-gray-500 text-sm">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <>
          <div className="max-h-[180px] overflow-y-auto divide-y divide-[#1a2540]">
            {selected.map((card) => (
              <div key={card.url || card.title} className="flex items-start gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-300 leading-snug line-clamp-2">{card.title}</p>
                  {card.source && <p className="text-[10px] text-gray-600 font-mono mt-0.5">{card.source}</p>}
                </div>
                <button onClick={() => onRemove(card.url || card.title)}
                  className="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 mt-0.5 transition-colors">×</button>
              </div>
            ))}
          </div>
          <div className="px-3 py-2.5 border-t border-[#1f2a3d] flex gap-2">
            <button onClick={onClear} className="flex-none text-[11px] text-gray-500 hover:text-gray-300 transition-colors">전체 해제</button>
            <button className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-500 transition-colors">
              문서로 정리하기 →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── 하이라이트 서랍 ───────────────────────────────────
function HighlightDrawer({
  highlights,
  onRemove,
  onClear,
}: {
  highlights: Highlight[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (highlights.length === 0) return null;

  return (
    <div className="bg-[#0d1420] border border-yellow-500/30 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none border-b border-yellow-500/20"
        onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-yellow-400 font-bold">내 표시</span>
          <span className="rounded-full bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 leading-none">{highlights.length}</span>
        </div>
        <span className="text-gray-500 text-sm">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-[#1a2540]">
            {highlights.map((h) => (
              <div key={h.id} className="flex items-start gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-600 font-mono truncate mb-0.5">{h.cardTitle}</p>
                  <p className="text-[11px] text-yellow-200 leading-snug">{h.text}</p>
                  <p className="text-[9px] text-gray-600 font-mono mt-0.5">
                    {h.createdAt.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
                <button onClick={() => onRemove(h.id)} className="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 mt-0.5 transition-colors">×</button>
              </div>
            ))}
          </div>
          <div className="px-3 py-2.5 border-t border-yellow-500/20">
            <button onClick={onClear} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">전체 삭제</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── 캔버스 ────────────────────────────────────────────
function MindMapCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [topic, setTopic] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [detailCard, setDetailCard] = useState<CardData | null>(null);
  const [selectedCards, setSelectedCards] = useState<CardData[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const { fitView } = useReactFlow();

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const expandRef = useRef<(nodeId: string, label: string, depth: number) => void>();

  const toggleSelect = useCallback((card: CardData) => {
    setSelectedCards((prev) => {
      const key = card.url || card.title;
      const exists = prev.some((c) => (c.url || c.title) === key);
      if (exists) return prev.filter((c) => (c.url || c.title) !== key);
      return [...prev, card];
    });
    setNodes((prev) =>
      prev.map((n) => {
        const d = n.data as unknown as ResearchNodeData;
        if ((d.url || d.title) === (card.url || card.title)) {
          return { ...n, data: { ...d, isSelected: !d.isSelected } as unknown as Record<string, unknown> };
        }
        return n;
      })
    );
  }, [setNodes]);

  const applyGraph = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      const positions = computeLayout(newNodes, newEdges);
      const positioned = newNodes.map((n) => ({
        ...n,
        position: positions[n.id] ?? n.position,
      }));
      setNodes(positioned);
      setEdges(newEdges);
      requestAnimationFrame(() => fitView({ padding: 0.25, duration: 700 }));
    },
    [setNodes, setEdges, fitView]
  );

  const addHighlight = useCallback((card: CardData, text: string) => {
    const hlId = `hl-${Date.now()}`;

    setHighlights((prev) => [
      ...prev,
      { id: hlId, cardTitle: card.title, cardUrl: card.url, text, createdAt: new Date().toISOString() },
    ]);

    const sourceNode = nodesRef.current.find((n) => {
      const d = n.data as unknown as ResearchNodeData;
      return (d.url || d.title) === (card.url || card.title);
    });
    if (!sourceNode) return;

    const sourceDepth = (sourceNode.data as unknown as ResearchNodeData).depth;

    const hlCard: CardData = {
      title: text.length > 80 ? text.slice(0, 80) + '…' : text,
      summary: card.title,
      content: text,
      url: card.url,
      image: '',
      source: card.source,
      publishedDate: card.publishedDate,
      type: card.type,
      isHighlight: true,
    };

    const hlNode: Node = {
      id: hlId,
      type: 'research',
      position: { x: 0, y: 0 },
      data: {
        ...hlCard,
        depth: sourceDepth + 1,
        isExpanded: true,
        isLoading: false,
        isSelected: false,
        onExpand: () => {},
        onDetail: () => setDetailCard(hlCard),
        onSelect: () => toggleSelect(hlCard),
      } satisfies ResearchNodeData,
    };

    const hlEdge = makeEdge(sourceNode.id, hlId);
    applyGraph([...nodesRef.current, hlNode], [...edgesRef.current, hlEdge]);
  }, [toggleSelect, applyGraph]);

  const removeHighlight = useCallback((id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    const newNodes = nodesRef.current.filter((n) => n.id !== id);
    const newEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id);
    applyGraph(newNodes, newEdges);
  }, [applyGraph]);

  const makeNode = useCallback(
    (id: string, card: CardData, depth: number): Node => {
      const isSelected = selectedCards.some((c) => (c.url || c.title) === (card.url || card.title));
      return {
        id,
        type: 'research',
        position: { x: 0, y: 0 },
        data: {
          ...card,
          depth,
          isExpanded: false,
          isLoading: false,
          isSelected,
          onExpand: () => expandRef.current?.(id, card.title, depth),
          onDetail: () => setDetailCard(card),
          onSelect: () => toggleSelect(card),
        } satisfies ResearchNodeData,
      };
    },
    [selectedCards, toggleSelect]
  );

  const doExpand = useCallback(
    async (nodeId: string, label: string, depth: number) => {
      setError('');
      setNodes((prev) =>
        prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true } } : n)
      );

      let branches: CardData[];
      try {
        branches = await fetchBranches(label);
      } catch {
        setNodes((prev) =>
          prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n)
        );
        setError('탐구 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      const ts = Date.now();
      const newNodes = branches.map((b, i) => makeNode(`n-${ts}-${i}`, b, depth + 1));
      const newEdges = newNodes.map((n) => makeEdge(nodeId, n.id));
      const prevNodes = nodesRef.current.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false, isExpanded: true } } : n
      );
      applyGraph([...prevNodes, ...newNodes], [...edgesRef.current, ...newEdges]);
    },
    [makeNode, applyGraph, setNodes]
  );

  expandRef.current = doExpand;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isSearching) return;

    setIsSearching(true);
    setError('');
    setSelectedCards([]);
    setDetailCard(null);

    const rootCard: CardData = { title: topic, summary: '', content: '', url: '', image: '', source: '', publishedDate: '', type: 'web' };
    const rootId = 'root';
    const rootNode = makeNode(rootId, rootCard, 0);
    rootNode.data = { ...rootNode.data, isExpanded: true };
    setNodes([{ ...rootNode, position: { x: 0, y: 0 } }]);
    setEdges([]);

    let branches: CardData[];
    try {
      branches = await fetchBranches(topic);
    } catch {
      setError('검색 중 오류가 발생했습니다. API 키를 확인해주세요.');
      setIsSearching(false);
      return;
    }

    const ts = Date.now();
    const branchNodes = branches.map((b, i) => makeNode(`n-${ts}-${i}`, b, 1));
    const branchEdges = branchNodes.map((n) => makeEdge(rootId, n.id));
    applyGraph([rootNode, ...branchNodes], branchEdges);
    setIsSearching(false);
  };

  const handleReset = () => {
    setNodes([]); setEdges([]); setTopic(''); setError('');
    setSelectedCards([]); setDetailCard(null);
  };

  const cardHighlights = detailCard
    ? highlights.filter((h) => h.cardUrl === detailCard.url && h.cardTitle === detailCard.title)
    : [];

  return (
    <div className="flex flex-col h-screen bg-[#070b14]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-[#0d1117]/90 backdrop-blur z-10">
        <span className="text-base font-bold text-white whitespace-nowrap">리서치 맵</span>
        <form onSubmit={handleSearch} className="flex flex-1 gap-2 max-w-2xl">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="탐구할 주제를 입력하세요 (예: 인공지능, 기후변화, 우주여행...)"
            className="flex-1 rounded-lg bg-[#1a2030] px-4 py-2 text-sm text-white placeholder-gray-600 border border-gray-700 focus:border-indigo-500 focus:outline-none transition-colors"
          />
          <button type="submit" disabled={isSearching || !topic.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
            {isSearching ? '탐구 중...' : '탐구 시작'}
          </button>
          {nodes.length > 0 && (
            <button type="button" onClick={handleReset}
              className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 transition-colors">
              초기화
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-red-900/40 border border-red-700 px-4 py-2 text-xs text-red-300">{error}</div>
      )}

      {/* 캔버스 */}
      <div className="flex-1 relative overflow-hidden">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes} fitView minZoom={0.1} maxZoom={2}
          nodesDraggable nodesConnectable={false} elementsSelectable={false}
        >
          <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {nodes.length === 0 && !isSearching && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-5xl mb-4">🗺️</p>
              <p className="text-gray-500 text-sm">주제를 입력하면 탐구 맵이 그려집니다</p>
              <p className="text-gray-600 text-xs mt-1">카드를 클릭해서 계속 탐구해보세요</p>
            </div>
          </div>
        )}

        {isSearching && nodes.length <= 1 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-gray-400 text-sm">인터넷을 탐색하는 중...</p>
            </div>
          </div>
        )}

        {/* 상세 패널 */}
        {detailCard && (
          <DetailPanel
            card={detailCard}
            isSelected={selectedCards.some((c) => (c.url || c.title) === (detailCard.url || detailCard.title))}
            cardHighlights={cardHighlights}
            onClose={() => setDetailCard(null)}
            onSelect={() => toggleSelect(detailCard)}
            onAddHighlight={(text) => addHighlight(detailCard, text)}
            onRemoveHighlight={removeHighlight}
          />
        )}

        {/* 서랍 컨테이너: 상세 패널 있으면 왼쪽으로 이동 */}
        <div className={`absolute bottom-4 z-20 w-[300px] flex flex-col gap-2 transition-all duration-300 ${detailCard ? 'right-[392px]' : 'right-4'}`}>
          <HighlightDrawer
            highlights={highlights}
            onRemove={removeHighlight}
            onClear={() => setHighlights([])}
          />
          <SelectionDrawer
            selected={selectedCards}
            onRemove={(key) => {
              setSelectedCards((prev) => prev.filter((c) => (c.url || c.title) !== key));
              setNodes((prev) =>
                prev.map((n) => {
                  const d = n.data as unknown as ResearchNodeData;
                  if ((d.url || d.title) === key) return { ...n, data: { ...d, isSelected: false } as unknown as Record<string, unknown> };
                  return n;
                })
              );
            }}
            onClear={() => {
              setSelectedCards([]);
              setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, isSelected: false } })));
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ReactFlowProvider>
      <MindMapCanvas />
    </ReactFlowProvider>
  );
}
