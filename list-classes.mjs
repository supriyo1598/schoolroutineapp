const SUPABASE_URL = 'https://alvsbdpthryzaahpmzkj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdnNiZHB0aHJ5emFhaHBtemtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjY2OTksImV4cCI6MjA4OTkwMjY5OX0.TMjlJI0L8E6jqyhFpPUWFaU3blp6_XEQA-K9gHfzcWI';

async function main() {
  const url = `${SUPABASE_URL}/rest/v1/app_state?key=eq.schedule_data&select=value`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  const data = await response.json();
  if (data && data[0]?.value) {
    const classes = data[0].value.classes || [];
    console.log('Current Classes:');
    classes.forEach(c => console.log(`- ${c.name} (ID: ${c.id})`));
  } else {
    console.log('No schedule data found.');
  }
}

main();
