import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/journey/run/route';

describe('/api/journey/run', () => {
  it('runs signup journey and exposes it via history endpoint', async () => {
    const request = new NextRequest('http://localhost/api/journey/run', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'signup',
        mode: 'keyboard-only',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const postResponse = await POST(request);
    expect(postResponse.status).toBe(201);

    const run = await postResponse.json();
    expect(run.journeyId).toBe('signup');
    expect(Array.isArray(run.stepOutcomes)).toBe(true);
    expect(run.stepOutcomes).toHaveLength(3);

    const listResponse = await GET();
    const listData = await listResponse.json();
    expect(Array.isArray(listData.runs)).toBe(true);
    expect(listData.runs.some((item: { runId: string }) => item.runId === run.runId)).toBe(true);
  });
});
