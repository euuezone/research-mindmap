'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ResearchNode } from '@/components/ResearchNode';
import { computeLayout } from '@/lib/layout';

const nodeTypes = { research: ResearchNode };

interface Branch {
  title: string;
  summary: string;
}

async function fetchBranches(topic: string): Promise<Branch[]> {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });
  const data = (await res.json()) as { branches?: Branch[]; error?: string };
  if (data.error) throw new Error(data.error);
  return data.branches || [];
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    animated: true,
    style: { stroke: '#4f46e5', strokeWidth: 1.5 },
  };
}

function MindMapCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [topic, setTopic] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const { fitView } = useReactFlow();

  // 항상 최신 그래프 상태를 가리키는 ref
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // 노드 확장 핸들러를 ref로 관리 (stale closure 방지)
  const expandRef = useRef<(nodeId: string, label: string, depth: number) => void>();

  const applyGraph = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      const positions = computeLayout(newNodes, newEdges);
      const positioned = newNodes.map((n) => ({
        ...n,
        position: positions[n.id] ?? n.position,
      }));
      setNodes(positioned);
      setEdges(newEdges);
      requestAnimationFrame(() =>
        fitView({ padding: 0.25, duration: 700 })
      );
    },
    [setNodes, setEdges, fitView]
  );

  const makeNode = useCallback(
    (id: string, label: string, summary: string, depth: number): Node => ({
      id,
      type: 'research',
      position: { x: 0, y: 0 },
      data: {
        label,
        summary,
        depth,
        isExpanded: false,
        isLoading: false,
        onExpand: () => expandRef.current?.(id, label, depth),
      },
    }),
    []
  );

  const doExpand = useCallback(
    async (nodeId: string, label: string, depth: number) => {
      setError('');

      // 해당 노드 로딩 상태로 변경
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true } } : n
        )
      );

      let branches: Branch[];
      try {
        branches = await fetchBranches(label);
      } catch (e) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
          )
        );
        setError('탐구 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      const ts = Date.now();
      const newNodes = branches.map((b, i) =>
        makeNode(`n-${ts}-${i}`, b.title, b.summary, depth + 1)
      );
      const newEdges = newNodes.map((n) => makeEdge(nodeId, n.id));

      const prevNodes = nodesRef.current.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, isLoading: false, isExpanded: true } }
          : n
      );
      const prevEdges = edgesRef.current;

      applyGraph([...prevNodes, ...newNodes], [...prevEdges, ...newEdges]);
    },
    [makeNode, applyGraph, setNodes]
  );

  // ref를 항상 최신 함수로 업데이트
  expandRef.current = doExpand;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isSearching) return;

    setIsSearching(true);
    setError('');

    const rootId = 'root';
    const rootNode = makeNode(rootId, topic, '', 0);
    // 루트 노드는 확장 버튼 없이 표시
    rootNode.data = { ...rootNode.data, isExpanded: true };
    setNodes([{ ...rootNode, position: { x: 0, y: 0 } }]);
    setEdges([]);

    let branches: Branch[];
    try {
      branches = await fetchBranches(topic);
    } catch {
      setError('검색 중 오류가 발생했습니다. API 키를 확인해주세요.');
      setIsSearching(false);
      return;
    }

    const ts = Date.now();
    const branchNodes = branches.map((b, i) =>
      makeNode(`n-${ts}-${i}`, b.title, b.summary, 1)
    );
    const branchEdges = branchNodes.map((n) => makeEdge(rootId, n.id));

    applyGraph([rootNode, ...branchNodes], branchEdges);
    setIsSearching(false);
  };

  const handleReset = () => {
    setNodes([]);
    setEdges([]);
    setTopic('');
    setError('');
  };

  return (
    <div className="flex flex-col h-screen bg-[#070b14]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-[#0d1117]/90 backdrop-blur z-10">
        <span className="text-base font-bold text-white whitespace-nowrap">🔍 리서치 맵</span>

        <form onSubmit={handleSearch} className="flex flex-1 gap-2 max-w-2xl">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="탐구할 주제를 입력하세요 (예: 인공지능, 기후변화, 우주여행...)"
            className="flex-1 rounded-lg bg-[#1a2030] px-4 py-2 text-sm text-white placeholder-gray-600 border border-gray-700 focus:border-indigo-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={isSearching || !topic.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isSearching ? '탐구 중...' : '탐구 시작'}
          </button>
          {nodes.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 transition-colors"
            >
              초기화
            </button>
          )}
        </form>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-red-900/40 border border-red-700 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* 리액트 플로우 캔버스 */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#1e293b"
            gap={24}
            size={1}
          />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor="#4f46e5"
            maskColor="rgba(7,11,20,0.7)"
            style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 8 }}
          />
        </ReactFlow>

        {/* 빈 상태 안내 */}
        {nodes.length === 0 && !isSearching && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-5xl mb-4">🗺️</p>
              <p className="text-gray-500 text-sm">주제를 입력하면 탐구 맵이 그려집니다</p>
              <p className="text-gray-600 text-xs mt-1">가지를 클릭해서 계속 탐구해보세요</p>
            </div>
          </div>
        )}

        {/* 초기 로딩 인디케이터 */}
        {isSearching && nodes.length <= 1 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-gray-400 text-sm">인터넷을 탐색하는 중...</p>
            </div>
          </div>
        )}
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
