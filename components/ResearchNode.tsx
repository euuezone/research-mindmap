'use client';

import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
import type { CardData } from '@/app/api/research/route';

export interface ResearchNodeData extends CardData {
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  isSelected: boolean;
  onExpand: () => void;
  onDetail: () => void;
  onSelect: () => void;
}

const TYPE_BADGE: Record<CardData['type'], { label: string; color: string }> = {
  news:    { label: 'NEWS',    color: '#3b82f6' },
  blog:    { label: 'BLOG',    color: '#8b5cf6' },
  paper:   { label: 'PAPER',   color: '#14b8a6' },
  youtube: { label: 'YOUTUBE', color: '#ef4444' },
  web:     { label: 'WEB',     color: '#6b7280' },
};

export const ResearchNode = memo(function ResearchNode({
  data,
}: {
  data: ResearchNodeData;
}) {
  const badge = TYPE_BADGE[data.type] || TYPE_BADGE.web;
  const isRoot = data.depth === 0;

  // 하이라이트 카드 노드
  if (data.isHighlight) {
    return (
      <div
        className="rounded-xl bg-[#0d1420] text-white select-none overflow-hidden flex flex-col"
        style={{
          width: 232,
          border: data.isSelected ? '2px solid #fbbf24' : '2px solid #ca8a04',
          boxShadow: data.isSelected
            ? '0 0 0 2px #fbbf24, 0 4px 20px rgba(251,191,36,0.25)'
            : '0 0 14px rgba(202,138,4,0.2)',
        }}
      >
        <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />

        {/* 상단 노란 바 */}
        <div className="h-1 w-full bg-yellow-500 flex-shrink-0" />

        <div className="flex flex-col gap-1.5 px-3 pt-2 pb-2 flex-1">
          {/* 배지 */}
          <span className="self-start rounded-full px-2 py-0.5 text-[9px] font-bold font-mono tracking-wider"
            style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)' }}>
            HIGHLIGHT
          </span>

          {/* 표시 텍스트 */}
          <p className="text-[12px] font-semibold leading-snug line-clamp-3 text-yellow-100">
            {data.title}
          </p>

          {/* 출처 카드 */}
          {data.summary && (
            <p className="text-[10px] text-gray-500 font-mono truncate">
              ↑ {data.summary}
            </p>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex border-t border-[#2a3040] divide-x divide-[#2a3040]">
          <button
            onClick={(e) => { e.stopPropagation(); data.onDetail(); }}
            className="flex-1 py-1.5 text-[11px] text-gray-400 hover:bg-[#1a2540] hover:text-white transition-colors"
          >
            상세보기
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); data.onSelect(); }}
            className={`flex-1 py-1.5 text-[11px] transition-colors ${
              data.isSelected
                ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                : 'text-gray-400 hover:bg-[#1a2540] hover:text-white'
            }`}
          >
            {data.isSelected ? '✓ 선택됨' : '선택'}
          </button>
        </div>
      </div>
    );
  }

  if (isRoot) {
    return (
      <div
        className="rounded-xl border-2 border-indigo-500 bg-[#0f1623] px-5 py-4 text-white select-none"
        style={{ minWidth: 180, maxWidth: 220, boxShadow: '0 0 24px rgba(99,102,241,0.35)' }}
      >
        <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />
        <p className="text-sm font-bold leading-snug text-white text-center">{data.title}</p>
        <p className="mt-1 text-[11px] text-indigo-400 text-center font-mono">ROOT</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border bg-[#0d1420] text-white select-none overflow-hidden flex flex-col"
      style={{
        width: 248,
        borderColor: data.isSelected ? '#facc15' : '#1f2a3d',
        boxShadow: data.isSelected
          ? '0 0 0 2px #facc15, 0 4px 20px rgba(250,204,21,0.2)'
          : '0 2px 12px rgba(0,0,0,0.4)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* 썸네일 */}
      {data.image ? (
        <div className="w-full h-[100px] overflow-hidden bg-[#111827]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      ) : (
        <div className="w-full h-[40px] bg-[#111827]" />
      )}

      {/* 본문 */}
      <div className="flex flex-col gap-1.5 px-3 pt-2 pb-2 flex-1">
        {/* 유형 배지 */}
        <span
          className="self-start rounded-full px-2 py-0.5 text-[9px] font-bold font-mono tracking-wider"
          style={{ background: badge.color + '22', color: badge.color, border: `1px solid ${badge.color}44` }}
        >
          {badge.label}
        </span>

        {/* 제목 */}
        <p className="text-[12px] font-semibold leading-snug line-clamp-2 text-white">
          {data.title}
        </p>

        {/* 요약 */}
        {data.summary && (
          <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3">
            {data.summary}
          </p>
        )}

        {/* 출처·날짜 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {data.source && <span className="text-[10px] text-gray-600 font-mono">{data.source}</span>}
          {data.publishedDate && (
            <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
              {fmtDate(data.publishedDate)}
            </span>
          )}
        </div>
      </div>

      {/* 로딩 */}
      {data.isLoading && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[11px] text-gray-500">
          <span className="inline-block h-3 w-3 rounded-full border border-gray-500 border-t-transparent animate-spin" />
          탐구 중...
        </div>
      )}

      {/* 원문 바로가기 */}
      {data.url && !data.isLoading && (
        <div className="px-3 pb-2">
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block w-full rounded border border-[#2d3f60] py-1 text-center text-[10px] text-gray-500 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
          >
            원문 바로가기 →
          </a>
        </div>
      )}

      {/* 액션 버튼 3종 */}
      {!data.isLoading && (
        <div className="flex border-t border-[#1f2a3d] divide-x divide-[#1f2a3d]">
          <button
            onClick={(e) => { e.stopPropagation(); data.onDetail(); }}
            className="flex-1 py-1.5 text-[11px] text-gray-400 hover:bg-[#1a2540] hover:text-white transition-colors"
          >
            상세보기
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); data.onSelect(); }}
            className={`flex-1 py-1.5 text-[11px] transition-colors ${
              data.isSelected
                ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                : 'text-gray-400 hover:bg-[#1a2540] hover:text-white'
            }`}
          >
            {data.isSelected ? '✓ 선택됨' : '선택'}
          </button>
          {!data.isExpanded && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onExpand(); }}
              className="flex-1 py-1.5 text-[11px] text-indigo-400 hover:bg-[#1a2540] hover:text-indigo-300 transition-colors"
            >
              + 확장
            </button>
          )}
        </div>
      )}
    </div>
  );
});
