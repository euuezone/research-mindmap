import OpenAI from 'openai';

interface Branch {
  title: string;
  summary: string;
}

export async function POST(request: Request) {
  const { topic } = (await request.json()) as { topic: string };

  if (!topic?.trim()) {
    return Response.json({ error: 'topic is required' }, { status: 400 });
  }

  // 1. Tavily 웹 검색
  let searchContext = '';
  try {
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: topic,
        max_results: 5,
        search_depth: 'basic',
      }),
    });
    const tavilyData = (await tavilyRes.json()) as {
      results?: { title: string; content: string }[];
    };
    const results = tavilyData.results || [];
    searchContext = results
      .map((r) => `제목: ${r.title}\n내용: ${r.content}`)
      .join('\n\n---\n\n');
  } catch {
    searchContext = '검색 결과를 가져올 수 없습니다.';
  }

  // 2. GPT-4o가 3개 가지 생성
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const msg = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `주제: "${topic}"

웹 검색 결과:
${searchContext}

위 정보를 바탕으로, 이 주제를 더 깊이 탐구하기 위한 3가지 핵심 하위 주제를 제안해주세요.
각 항목은 서로 다른 관점(예: 역사적 배경, 현재 동향, 미래 전망 / 또는 기술적, 사회적, 경제적)을 다루면 좋습니다.

반드시 아래 JSON 형식만 반환하세요:
{"branches":[{"title":"하위 주제 제목","summary":"2-3문장 핵심 설명"},{"title":"...","summary":"..."},{"title":"...","summary":"..."}]}`,
      },
    ],
  });

  const raw = msg.choices[0].message.content || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return Response.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
  }

  const parsed = JSON.parse(jsonMatch[0]) as { branches: Branch[] };
  return Response.json(parsed);
}
