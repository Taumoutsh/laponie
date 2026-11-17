import { isAuthenticated } from '@/lib/auth';
import { loadEvent } from '@/lib/event-data';
import { buildWorkbook, type ExportOptions } from '@/lib/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'evenement'
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAuthenticated())) return new Response('Non autorisé', { status: 401 });
  const { eventId } = await params;
  const view = await loadEvent(eventId);
  const q = new URL(request.url).searchParams;
  const flag = (key: string, def: boolean) => (q.has(key) ? q.get(key) === '1' || q.get(key) === 'on' : def);
  const group = q.get('group');
  // Formulaire envoyé : les cases décochées sont absentes, d'où le défaut « false ».
  const submitted = q.get('submitted') === '1';
  const opts: ExportOptions = {
    group: group === 'person' || group === 'couple' ? group : 'family',
    coupleMode: q.get('coupleMode') === 'column' ? 'column' : 'split',
    perPerson: flag('perPerson', !submitted),
    groups: flag('groups', !submitted),
    balances: flag('balances', !submitted),
    flows: flag('flows', false),
    colStatus: flag('colStatus', !submitted),
    colLink: flag('colLink', false),
    colAdvance: flag('colAdvance', !submitted),
  };
  const buffer = await buildWorkbook(view, opts);
  const filename = `${slug(view.event.name)}_budget-cadeaux.xlsx`;
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
