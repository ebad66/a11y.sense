import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProfile, ProfileId } from '@/lib/profiles';
import { simulateProfileView } from '@/lib/gemini';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, profileId, screenshotBase64, screenshotMimeType } = body;

    if (!sessionId || !profileId) {
      return NextResponse.json({ error: 'Missing sessionId or profileId' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    let profile;
    try {
      profile = getProfile(profileId as ProfileId);
    } catch {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 });
    }

    const imageData = screenshotBase64 || session.screenshot;
    const imageMime = screenshotMimeType || session.screenshotMime || 'image/png';

    if (!imageData) {
      return NextResponse.json(
        { error: 'No screenshot available for this session.' },
        { status: 400 }
      );
    }

    const keyPreview = (process.env.GEMINI_API_KEY || '').slice(0, 8);
    console.log(`[Simulate] Running ${profile.label} simulation | key starts with: ${keyPreview}…`);


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
      { error: `Simulation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
