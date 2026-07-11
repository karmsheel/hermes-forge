import { createLocalSessionResponse } from '@/lib/local-user';

/** Start or resume the machine-local session (chosen explicitly on /sign-in or Profile). */
export async function POST() {
  try {
    return await createLocalSessionResponse();
  } catch (error) {
    console.error('Local session error', error);
    return Response.json({ error: 'Failed to start local session' }, { status: 500 });
  }
}
