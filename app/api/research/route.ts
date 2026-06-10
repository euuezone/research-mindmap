import OpenAI from 'openai';

function extractDateFromUrl(url: string): string {
  // YYYY/MM/DD 또는 YYYY-MM-DD 패턴
  const m1 = url.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (m1) {
    const [, y, mo, d] = m1;
    const year = parseInt(y);
    if (year >= 2000 && year <= 2035) return `${y}-${mo}-${d}`;
  }
  // YYYYMMDD 패턴 (URL 구분자 사이 8자리 숫자)
  const m2 = url.match(/[\/\-_](\d{8})(?:[\/\-_\?#]|$)/);
  if (m2) {
    const s = m2[1];
    const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
    const year = parseInt(y), month = parseInt(mo), day = parseInt(d);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${mo}-${d}`;
    }
  }
  return '';
}

export interface CardData {
  title: string;
  summary: string;
  content: string;
  url: string;
  image: string;
  source: string;
  publishedDate: string;
  type: 'news' | 'blog' | 'paper' | 'youtube' | 'web';
  isHighlight?: boolean;
}

export async function POST(request: Request) {
  const { topic } = (await request.json()) as { topic: string };

  if (!topic?.trim()) {
    return Response.json({ error: 'topic is required' }, { status: 400 });
  }

  // 1. Tavily 웹 검색 — url·image·published_date 포함
  let tavilyResults: {
    title: string;
    content: string;
    url: string;
    image?: string;
    published_date?: string;
  }[] = [];

  try {
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: topic,
        max_results: 6,
        search_depth: 'basic',
        include_images: true,
      }),
    });
    const tavilyData = (await tavilyRes.json()) as {
      results?: typeof tavilyResults;
    };
    tavilyResults = tavilyData.results || [];
  } catch {
    // 검색 실패해도 GPT만으로 진행
  }

  const searchContext = tavilyResults
    .map((r, i) => `[${i}] 제목: ${r.title}\nURL: ${r.url}\n내용: ${r.content}`)
    .join('\n\n---\n\n');

  // 2. GPT-4o — 검색 결과를 카드 배열로 변환
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt =
    tavilyResults.length > 0
      ? `주제: "${topic}"

웹 검색 결과:
${searchContext}

위 검색 결과를 기반으로, 이 주제를 탐구하는 카드 목록을 만들어주세요.
검색 결과 개수와 같게(최대 6개) 카드를 만드세요. 인덱스 [0]~[${tavilyResults.length - 1}]에 각각 대응합니다.

각 카드의 type은 URL을 보고 판단하세요:
- youtube.com 포함 → "youtube"
- arxiv.org, scholar, researchgate, doi 포함 → "paper"
- 뉴스 도메인(naver.com/news, yna.co.kr, yonhap, chosun, joongang, hani, 등) → "news"
- 나머지 → "blog" 또는 "web"

publishedDate: 내용(content)에서 날짜를 찾아 "YYYY-MM-DD" 형식으로 추출하세요. 찾을 수 없으면 빈 문자열 "".

반드시 아래 JSON 형식만 반환하세요:
{"branches":[{"title":"카드 제목(원문 그대로 또는 요약)","summary":"2~3문장 한국어 요약","type":"news|blog|paper|youtube|web","publishedDate":"YYYY-MM-DD 또는 빈 문자열"},...]}`
      : `주제: "${topic}"

검색 결과 없음. 이 주제를 탐구하는 3가지 하위 주제를 제안해주세요.

반드시 아래 JSON 형식만 반환하세요:
{"branches":[{"title":"하위 주제","summary":"2~3문장 설명","type":"web"},{"title":"...","summary":"...","type":"web"},{"title":"...","summary":"...","type":"web"}]}`;

  const msg = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.choices[0].message.content || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return Response.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    branches: { title: string; summary: string; type: string; publishedDate?: string }[];
  };

  // Tavily 결과와 병합 — url·image·source·date 추가
  const branches: CardData[] = parsed.branches.map((b, i) => {
    const tv = tavilyResults[i];
    const url = tv?.url || '';
    const source = url ? new URL(url).hostname.replace('www.', '') : '';
    // 날짜 우선순위: Tavily published_date → URL 패턴 파싱 → GPT 추출 → 없음
    const publishedDate = tv?.published_date || extractDateFromUrl(url) || b.publishedDate || '';
    return {
      title: b.title,
      summary: b.summary,
      content: tv?.content || '',
      url,
      image: tv?.image || '',
      source,
      publishedDate,
      type: (b.type as CardData['type']) || 'web',
    };
  });

  return Response.json({ branches });
}
