import { createLocalSessionResponse } from '@/lib/local-user';

/** Bootstrap a single local session — no login UI for desktop/local use. */
export async function POST() {
  try {
    return await createLocalSessionResponse();
  } catch (error) {
    console.error('Local session error', error);
    return Response.json({ error: 'Failed to start local session' }, { status: 500 });
  }
}
