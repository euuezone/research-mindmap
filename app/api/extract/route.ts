export interface ExtractResult {
  rawContent: string;
  images: string[];
}

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };

  if (!url?.trim()) {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        urls: [url],
        include_images: true,
      }),
    });

    const data = (await res.json()) as {
      results?: { url: string; raw_content: string; images?: string[] }[];
      failed_results?: unknown[];
    };

    const result = data.results?.[0];
    if (!result) {
      return Response.json({ error: '원문을 가져올 수 없습니다.' }, { status: 404 });
    }

    const extracted: ExtractResult = {
      rawContent: result.raw_content || '',
      images: result.images || [],
    };

    return Response.json(extracted);
  } catch {
    return Response.json({ error: '원문 추출 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
