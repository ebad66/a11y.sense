import { GoogleGenAI } from '@google/genai';
import { Profile } from './profiles';

const MODEL = 'gemini-3-pro-image-preview'; // Nano Banana Pro

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 300000 } });
}

export interface SimulationResult {
  profileId: string;
  imageBase64: string;
  mimeType: string;
  description: string;
}

export async function simulateProfileView(
  screenshotBase64: string,
  screenshotMimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  profile: Profile
): Promise<SimulationResult> {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: screenshotMimeType,
              data: screenshotBase64,
            },
          },
          {
            text: `You are an accessibility horror-show visualization tool. Your ONLY job is to produce a SHOCKINGLY transformed version of this webpage screenshot. The transformation must be so extreme and obvious that a developer who sees it immediately understands the problem. Subtle = failure. Gentle = failure. If the page still looks usable, you have FAILED.

TRANSFORMATION INSTRUCTIONS — apply every single one at MAXIMUM intensity, no holding back:
${profile.geminiPrompt}

ABSOLUTE RULES — violating any of these means the output is wrong:
- If the result looks like a minor filter effect, redo it 10x stronger
- The before/after must look like completely different realities
- Every instruction in the prompt above must be visible and obvious in the output
- Do NOT soften, tone down, or "tastefully" apply effects — be brutal and educational
- Output the transformed image first, then write exactly 2 sentences describing the worst accessibility failures shown`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  });

  let imageBase64 = screenshotBase64; // fallback to original if no image returned
  let mimeType: string = screenshotMimeType;
  let description = '';

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.text) {
      description = part.text;
    } else if (part.inlineData) {
      imageBase64 = part.inlineData.data ?? screenshotBase64;
      mimeType = part.inlineData.mimeType ?? screenshotMimeType;
    }
  }

  return {
    profileId: profile.id,
    imageBase64,
    mimeType,
    description,
  };
}
