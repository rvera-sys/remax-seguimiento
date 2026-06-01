// ─── PARSER DE LENGUAJE NATURAL → MÉTRICAS ───────────────────────────────────
// Interpreta texto libre en español y extrae cantidades por métrica.
// No requiere IA externa — usa patrones y sinónimos del negocio inmobiliario.

// ── Números escritos en palabras ─────────────────────────────────────────────
const NUMEROS = {
  'cero': 0, 'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3,
  'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8,
  'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12, 'trece': 13,
  'catorce': 14, 'quince': 15, 'veinte': 20,
};

// ── Sinónimos por métrica ─────────────────────────────────────────────────────
const SINONIMOS = {
  reunionesVerdes: [
    'reunion verde', 'reuniones verdes', 'meeting verde', 'meetings verdes',
    'reunión verde', 'cita verde', 'citas verdes', 'visita verde', 'visitas verdes',
  ],
  preListing: [
    'pre-listing', 'prelisting', 'pre listing', 'acm', 'analisis comparativo',
    'análisis comparativo', 'tasacion', 'tasación', 'valuacion', 'valuación',
    'presentacion de captacion', 'presentación de captación',
  ],
  preBuying: [
    'pre-buying', 'prebuying', 'pre buying', 'presentacion de compra',
    'presentación de compra', 'buyer consultation', 'consulta de compra',
  ],
  reservas: [
    'reserva', 'reservas', 'oferta', 'ofertas', 'propuesta', 'propuestas',
    'hice una oferta', 'presenté una oferta', 'oferta presentada',
  ],
  cierresVenta: [
    'cierre de venta', 'cierres de venta', 'boleto de venta', 'boletos de venta',
    'escritura de venta', 'escrituras de venta', 'vendí', 'vendi',
    'venta cerrada', 'ventas cerradas', 'cerré una venta', 'cerre una venta',
    'cerré venta', 'firmamos boleto de venta',
  ],
  cierresCompra: [
    'cierre de compra', 'cierres de compra', 'boleto de compra', 'boletos de compra',
    'escritura de compra', 'escrituras de compra', 'compré', 'compre',
    'compra cerrada', 'compras cerradas', 'cerré una compra', 'cerre una compra',
    'firmamos boleto de compra',
  ],
  llamados: [
    'llamado', 'llamados', 'llamada', 'llamadas', 'llamé', 'llame',
    'contacto telefonico', 'contacto telefónico', 'contactos telefonicos',
    'contactos telefónicos', 'whatsapp', 'mensaje de whatsapp',
    'mensajes de whatsapp', 'hablé por teléfono', 'hable por telefono',
    'contacté', 'contacte', 'llamé a clientes',
  ],
  notasPersonales: [
    'nota personal', 'notas personales', 'nota', 'notas', 'anotación',
    'anotaciones', 'seguimiento personal',
  ],
  eReport: [
    'e-report', 'ereport', 'e report', 'reporte', 'reportes',
    'informe', 'informes', 'market report', 'reporte de mercado',
    'envié reporte', 'envie reporte', 'mandé reporte',
  ],
  popBy: [
    'pop by', 'popby', 'pop-by', 'visita sorpresa', 'visitas sorpresa',
    'dropped by', 'fui a visitar', 'visita inesperada', 'visité', 'visite',
  ],
  eventos: [
    'evento', 'eventos', 'open house', 'jornada', 'feria', 'ferias',
    'charla', 'charlas', 'workshop', 'seminario', 'networking',
    'hice un evento', 'organicé', 'organice',
  ],
  redes: [
    'red social', 'redes sociales', 'instagram', 'facebook', 'linkedin',
    'publicacion', 'publicación', 'publicaciones', 'post', 'posts',
    'story', 'stories', 'publiqué', 'publique', 'posteé', 'postee',
    'subí a redes', 'subi a redes',
  ],
  nuevosContactos: [
    'nuevo contacto', 'nuevos contactos', 'contacto nuevo', 'contactos nuevos',
    'contacté a alguien', 'agregué', 'agregue', 'conocí', 'conoci',
    'lead', 'leads', 'prospecto', 'prospectos', 'prospecté', 'prospecte',
  ],
  captaciones: [
    'captacion', 'captación', 'captaciones', 'capté', 'capte',
    'propiedad captada', 'propiedades captadas', 'listing', 'listings',
    'captamos', 'nueva captacion', 'nueva captación', 'exclusiva',
  ],
};

// ── Función principal ─────────────────────────────────────────────────────────

function parsearTexto(texto) {
  const resultado = emptyDay();
  const textoNorm = normalizar(texto);
  const tokens    = tokenizar(textoNorm);

  METRICS_KEYS.forEach(metrica => {
    const sinonimos = SINONIMOS[metrica] || [];
    sinonimos.forEach(sin => {
      const sinNorm = normalizar(sin);
      const idx     = textoNorm.indexOf(sinNorm);
      if (idx === -1) return;

      const cantidad = extraerCantidad(textoNorm, idx, sinNorm.length);
      if (cantidad > 0) {
        resultado[metrica] = Math.max(resultado[metrica] || 0, cantidad);
      } else {
        // Si encontró la palabra pero sin número → asumir 1
        resultado[metrica] = Math.max(resultado[metrica] || 0, 1);
      }
    });
  });

  return resultado;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function normalizar(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/[^\w\s-]/g, ' ')       // quitar puntuación excepto guión
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizar(str) {
  return str.split(/\s+/);
}

function extraerCantidad(texto, posicion, longSinonimo) {
  // Buscar número antes del sinónimo (ej: "3 reuniones")
  const antes = texto.substring(Math.max(0, posicion - 30), posicion).trim();
  const matchAntes = antes.match(/(\d+|un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte)\s*$/i);
  if (matchAntes) {
    const n = parseInt(matchAntes[1]) || NUMEROS[matchAntes[1].toLowerCase()];
    if (n !== undefined && !isNaN(n)) return n;
  }

  // Buscar número después del sinónimo (ej: "reuniones: 3")
  const despues = texto.substring(posicion + longSinonimo, posicion + longSinonimo + 20).trim();
  const matchDespues = despues.match(/^[\s:]*(\d+)/);
  if (matchDespues) {
    return parseInt(matchDespues[1]);
  }

  return 0;
}

// ── Generar resumen legible de lo interpretado ────────────────────────────────

function generarResumenParseo(resultado) {
  const items = [];
  METRICS.forEach(m => {
    const val = resultado[m.key];
    if (val && val > 0) {
      items.push({ label: m.label, val, color: m.color, key: m.key });
    }
  });
  return items;
}
