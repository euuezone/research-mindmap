'use client';

import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

export interface ResearchNodeData {
  label: string;
  summary?: string;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  onExpand: () => void;
}

const DEPTH_STYLES = [
  { border: '#3b82f6', glow: 'rgba(59,130,246,0.3)', btn: '#3b82f6' },
  { border: '#8b5cf6', glow: 'rgba(139,92,246,0.3)', btn: '#8b5cf6' },
  { border: '#14b8a6', glow: 'rgba(20,184,166,0.3)', btn: '#14b8a6' },
  { border: '#f97316', glow: 'rgba(249,115,22,0.3)', btn: '#f97316' },
  { border: '#ec4899', glow: 'rgba(236,72,153,0.3)', btn: '#ec4899' },
];

export const ResearchNode = memo(function ResearchNode({
  data,
}: {
  data: ResearchNodeData;
}) {
  const s = DEPTH_STYLES[Math.min(data.depth, DEPTH_STYLES.length - 1)];

  return (
    <div
      style={{
        borderColor: s.border,
        boxShadow: `0 0 18px ${s.glow}`,
        minWidth: '200px',
        maxWidth: '220px',
      }}
      className="rounded-xl border-2 bg-[#0f1623] p-3 text-white select-none"
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />

      {/* 깊이 표시 바 */}
      <div
        style={{ backgroundColor: s.border }}
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
      />

      <p className="text-sm font-semibold leading-snug text-white">{data.label}</p>

      {data.summary && (
        <p className="mt-1.5 text-xs text-gray-400 leading-relaxed line-clamp-3">
          {data.summary}
        </p>
      )}

      {data.isLoading && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <span
            className="inline-block h-3 w-3 rounded-full border border-gray-500 border-t-transparent animate-spin"
          />
          탐구 중...
        </div>
      )}

      {!data.isExpanded && !data.isLoading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onExpand();
          }}
          style={{ backgroundColor: s.btn }}
          className="mt-2 w-full rounded-lg py-1 text-xs font-medium text-white hover:opacity-75 transition-opacity"
        >
          + 더 탐구하기
        </button>
      )}
    </div>
  );
});
