// Script to delete class cls_1774786436378 from Supabase schedule data

const SUPABASE_URL = 'https://alvsbdpthryzaahpmzkj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdnNiZHB0aHJ5emFhaHBtemtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjY2OTksImV4cCI6MjA4OTkwMjY5OX0.TMjlJI0L8E6jqyhFpPUWFaU3blp6_XEQA-K9gHfzcWI';

const CLASS_TO_DELETE = 'cls_1774805310380';

async function sbRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('1. Fetching current schedule data from Supabase...');
  const data = await sbRequest('app_state?key=eq.schedule_data&select=value');
  
  if (!data || !data[0]?.value) {
    console.log('No schedule data found in Supabase.');
    return;
  }

  const state = data[0].value;
  
  // Remove from classes array
  const originalClassCount = state.classes?.length || 0;
  state.classes = (state.classes || []).filter(c => c.id !== CLASS_TO_DELETE);
  console.log(`2. Classes: ${originalClassCount} → ${state.classes.length} (removed ${originalClassCount - state.classes.length})`);

  // Remove schedule entries with this class ID (both bare and composite keys)
  const keysToRemove = Object.keys(state.schedule || {}).filter(k => k === CLASS_TO_DELETE || k.startsWith(CLASS_TO_DELETE + '__'));
  for (const key of keysToRemove) {
    delete state.schedule[key];
  }
  console.log(`3. Removed ${keysToRemove.length} schedule entries: ${keysToRemove.join(', ') || 'none'}`);

  // Remove substitution entries
  for (const day of Object.keys(state.substitutions || {})) {
    const subKeysToRemove = Object.keys(state.substitutions[day] || {}).filter(k => k === CLASS_TO_DELETE || k.startsWith(CLASS_TO_DELETE + '__'));
    for (const key of subKeysToRemove) {
      delete state.substitutions[day][key];
    }
    if (subKeysToRemove.length > 0) {
      console.log(`   Removed ${subKeysToRemove.length} substitution entries for ${day}`);
    }
  }

  // Save back
  console.log('4. Saving updated data back to Supabase...');
  await sbRequest('app_state?on_conflict=key', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'schedule_data', value: state }),
  });

  console.log(`✅ Done! Class ${CLASS_TO_DELETE} has been completely deleted.`);
  console.log(`   Remaining classes: ${state.classes.map(c => c.name).join(', ')}`);
}

main().catch(err => console.error('Error:', err));
