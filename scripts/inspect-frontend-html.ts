/**
 * Inspeccionar HTML de la página de estaciones
 */

async function inspectHTML() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  try {
    console.log('Fetching HTML from:', `${baseUrl}/admin/estaciones`);
    const res = await fetch(`${baseUrl}/admin/estaciones`);
    const html = await res.text();
    
    console.log('\n=== PRIMEROS 2000 CARACTERES DEL HTML ===\n');
    console.log(html.substring(0, 2000));
    
    console.log('\n\n=== ÚLTIMOS 500 CARACTERES DEL HTML ===\n');
    console.log(html.substring(html.length - 500));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

inspectHTML();
