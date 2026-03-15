import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProfile, ProfileId } from '@/lib/profiles';
import { simulateProfileView } from '@/lib/gemini';
import { generateBlindSimulationHtml } from '@/lib/blind-simulation';
import { makeApiError } from '@/lib/api';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, profileId, screenshotBase64, screenshotMimeType } = body;

    if (!sessionId || !profileId) {
      return NextResponse.json(
        makeApiError('BAD_REQUEST', 'Missing sessionId or profileId.', {
          stage: 'simulate.validate',
          retryable: false,
        }),
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        makeApiError('MISSING_CONFIG', 'GEMINI_API_KEY is not configured.', {
          stage: 'simulate.config',
          retryable: false,
        }),
        { status: 500 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        makeApiError('SESSION_NOT_FOUND', 'Session not found or expired.', {
          stage: 'simulate.session',
          retryable: false,
        }),
        { status: 404 }
      );
    }

    let profile;
    try {
      profile = getProfile(profileId as ProfileId);
    } catch {
      return NextResponse.json(
        makeApiError('BAD_REQUEST', 'Invalid profile ID.', {
          stage: 'simulate.validate',
          retryable: false,
        }),
        { status: 400 }
      );
    }

    const imageData = screenshotBase64 || session.screenshot;
    const imageMime = screenshotMimeType || session.screenshotMime || 'image/png';

    if (!imageData) {
      return NextResponse.json(
        makeApiError('BAD_REQUEST', 'No screenshot available for this session.', {
          stage: 'simulate.validate',
          retryable: false,
        }),
        { status: 400 }
      );
    }

    // Blind profile: generate interactive HTML simulation instead of calling the image API
    if (profileId === 'blind') {
      const html = await generateBlindSimulationHtml(session.url);
      return NextResponse.json({ profileId: 'blind', type: 'html', html, description: '' });
    }

    const result = await simulateProfileView(
      imageData,
      imageMime as 'image/png' | 'image/jpeg' | 'image/webp',
      profile
    );

    return NextResponse.json({
      profileId: result.profileId,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      description: result.description,
    });
  } catch (err) {
    console.error('[Simulate] Error:', err);
    return NextResponse.json(
      makeApiError('SIMULATION_FAILED', `Simulation failed: ${(err as Error).message}`, {
        stage: 'simulate.execute',
        retryable: true,
      }),
      { status: 500 }
    );
  }
}
