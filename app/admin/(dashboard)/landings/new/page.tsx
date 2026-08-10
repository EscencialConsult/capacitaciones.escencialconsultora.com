import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { NewLandingForm } from './NewLandingForm';

export const dynamic = 'force-dynamic';

export default async function NewLandingPage() {
  const supabase = createSupabaseServiceClient();

  const [{ data: templates }, { data: emailTemplates }] = await Promise.all([
    supabase
      .from('landing_templates')
      .select('id, name, variables_schema')
      .eq('is_active', true)
      .order('name'),
    supabase.from('email_templates').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-800">Nueva landing</h1>
      <NewLandingForm templates={templates ?? []} emailTemplates={emailTemplates ?? []} />
    </div>
  );
}
