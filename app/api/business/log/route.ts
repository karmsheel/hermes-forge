import { NextRequest, NextResponse } from 'next/server';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { backfillBusinessLog } from '@/lib/business-log-backfill';
import { getBusinessEvents } from '@/lib/business-log';
import type { BusinessLogFilter } from '@/lib/business-log-types';

const VALID_FILTERS = new Set<BusinessLogFilter>([
  'all',
  'business',
  'process',
  'automation',
  'chat',
  'memory',
]);

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ events: [], nextCursor: null, business: null });
    }

    if (!business.backfillCompletedAt) {
      await backfillBusinessLog(business.id);
    }

    const { searchParams } = request.nextUrl;
    const cursor = searchParams.get('cursor');
    const limitParam = searchParams.get('limit');
    const filterParam = searchParams.get('filter') as BusinessLogFilter | null;

    const filter =
      filterParam && VALID_FILTERS.has(filterParam) ? filterParam : 'all';

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

    const { events, nextCursor } = await getBusinessEvents(business.id, {
      cursor,
      limit: Number.isFinite(limit) ? limit : 50,
      filter,
    });

    return NextResponse.json({
      events,
      nextCursor,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error('Business log error', error);
    return NextResponse.json({ error: 'Failed to load business log' }, { status: 500 });
  }
}