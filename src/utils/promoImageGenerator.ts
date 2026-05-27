import { supabase } from '../lib/supabase';

interface ProductoPromo {
    nombre: string;
    cantidad_sugerida: number;
    unidad: string;
}

interface Promocion {
    id: string;
    nombre: string;
    descripcion: string;
    productos: ProductoPromo[];
    descuento_porcentaje: number | null;
    vigencia_hasta: string | null;
}

const GEMINI_API_KEY = () => import.meta.env.VITE_GEMINI_API_KEY as string;

// Paso 1: Gemini genera el copy
async function generarCopy(promo: Promocion): Promise<{ titulo: string; subtitulo: string; tags: string[] }> {
    const prompt = `Sos un experto en marketing para carnicería mayorista argentina.
Generá el copy para una imagen de promoción de redes sociales (Instagram/WhatsApp).

Promoción: ${promo.nombre}
Descripción: ${promo.descripcion}
Productos: ${promo.productos.map(p => `${p.nombre} ${p.cantidad_sugerida}${p.unidad}`).join(', ')}
Descuento: ${promo.descuento_porcentaje ? promo.descuento_porcentaje + '%' : 'Sin descuento especificado'}

Respondé SOLO con JSON válido, sin texto extra, sin markdown:
{
  "titulo": "título impactante en mayúsculas (máx 20 caracteres)",
  "subtitulo": "subtítulo con los productos estrella (máx 40 caracteres)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY()}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.8 }
            })
        }
    );

    const data = await res.json();
    if (data.error) throw new Error('Gemini copy error: ' + data.error.message);

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const limpio = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(limpio);
}

// Paso 2: Gemini genera la imagen de fondo (imagen nativa con gemini-2.0-flash-preview-image-generation)
async function generarImagenFondo(promo: Promocion): Promise<string> {
    const promptVisual = `Professional food photography for Argentine meat wholesale business.
Show: ${promo.productos.slice(0, 2).map(p => p.nombre).join(' and ')}.
Style: dark moody background, dramatic lighting, smoke effects, rustic wooden table, Argentine asado BBQ atmosphere.
High quality restaurant photography. No text, no logos, no watermarks. Cinematic quality.`;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY()}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptVisual }] }],
                generationConfig: {
                    responseModalities: ['IMAGE', 'TEXT']
                }
            })
        }
    );

    const data = await res.json();
    if (data.error) throw new Error('Gemini imagen error: ' + JSON.stringify(data.error));

    // La imagen viene como base64 en inlineData
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart) throw new Error('Gemini no devolvió imagen. Respuesta: ' + JSON.stringify(parts).substring(0, 200));

    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

// Paso 3: Componer imagen final en Canvas
async function componerImagen(
    fondoDataUrl: string,
    copy: { titulo: string; subtitulo: string; tags: string[] },
    promo: Promocion
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;

        const fondo = new Image();
        fondo.onload = () => {
            // Fondo
            ctx.drawImage(fondo, 0, 0, 1080, 1080);

            // Overlay oscuro degradado
            const grad = ctx.createLinearGradient(0, 0, 0, 1080);
            grad.addColorStop(0, 'rgba(0,0,0,0.15)');
            grad.addColorStop(0.45, 'rgba(0,0,0,0.35)');
            grad.addColorStop(1, 'rgba(0,0,0,0.88)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 1080, 1080);

            // Franja primario arriba
            ctx.fillStyle = 'rgba(234,88,12,1)';
            ctx.fillRect(0, 0, 1080, 10);

            const logo = new Image();
            const dibujarTexto = () => {
                // Nombre empresa
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.font = 'bold 22px Arial';
                ctx.textAlign = 'left';
                ctx.fillText('DOBLE JJ ABASTECIMIENTOS', 145, 62);
                ctx.font = '16px Arial';
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.fillText('Mayorista de Carnes · Carlos Paz, Córdoba', 145, 85);

                // Badge descuento
                if (promo.descuento_porcentaje) {
                    ctx.fillStyle = 'rgba(234,88,12,1)';
                    ctx.beginPath();
                    ctx.arc(970, 155, 82, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 48px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${promo.descuento_porcentaje}%`, 970, 148);
                    ctx.font = 'bold 20px Arial';
                    ctx.fillText('DESCUENTO', 970, 178);
                    ctx.textAlign = 'left';
                }

                // Título principal
                ctx.textAlign = 'center';
                ctx.fillStyle = 'white';
                const tituloUpper = copy.titulo.toUpperCase();
                const tituloSize = ctx.measureText(tituloUpper).width > 900 ? 64 : 82;
                ctx.font = `bold ${tituloSize}px Arial`;
                ctx.fillText(tituloUpper, 540, 710);

                // Subtítulo
                ctx.fillStyle = 'rgba(255,195,80,1)';
                ctx.font = 'bold 34px Arial';
                ctx.fillText(copy.subtitulo, 540, 770);

                // Línea
                ctx.strokeStyle = 'rgba(234,88,12,0.85)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(180, 798);
                ctx.lineTo(900, 798);
                ctx.stroke();

                // Productos
                const prods = promo.productos.slice(0, 4).map(p => `${p.nombre} ${p.cantidad_sugerida}${p.unidad}`).join('  ·  ');
                ctx.fillStyle = 'rgba(255,255,255,0.72)';
                ctx.font = '24px Arial';
                ctx.fillText(prods, 540, 848);

                // Vigencia
                if (promo.vigencia_hasta) {
                    ctx.fillStyle = 'rgba(255,255,255,0.45)';
                    ctx.font = '19px Arial';
                    ctx.fillText(`Válido hasta el ${new Date(promo.vigencia_hasta).toLocaleDateString('es-AR')}`, 540, 898);
                }

                // Tags
                ctx.fillStyle = 'rgba(234,88,12,0.95)';
                ctx.font = 'bold 17px Arial';
                ctx.fillText(copy.tags.map(t => `#${t}`).join('  '), 540, 1042);

                // Franja abajo
                ctx.fillStyle = 'rgba(234,88,12,1)';
                ctx.fillRect(0, 1070, 1080, 10);

                ctx.textAlign = 'left';
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Error generando blob'));
                }, 'image/jpeg', 0.93);
            };

            logo.onload = () => {
                ctx.drawImage(logo, 44, 28, 82, 82);
                dibujarTexto();
            };
            logo.onerror = dibujarTexto;
            logo.src = '/logo_ticket.png';
        };
        fondo.onerror = () => reject(new Error('Error cargando imagen de fondo'));
        fondo.src = fondoDataUrl;
    });
}

// Paso 4: Subir a Supabase Storage
async function subirImagen(blob: Blob, promoId: string): Promise<string> {
    const fileName = `promo_${promoId}_${Date.now()}.jpg`;

    const { error } = await supabase.storage
        .from('promociones')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('promociones')
        .getPublicUrl(fileName);

    await supabase
        .from('promociones_sugeridas')
        .update({ imagen_url: publicUrl })
        .eq('id', promoId);

    return publicUrl;
}

// Función principal
export async function generarImagenPromocion(
    promo: Promocion,
    onProgress?: (paso: string) => void
): Promise<string> {
    // Normalizar productos: puede llegar como string JSON desde Supabase
    const promoNormalizada: Promocion = {
        ...promo,
        productos: typeof promo.productos === 'string'
            ? JSON.parse(promo.productos)
            : (Array.isArray(promo.productos) ? promo.productos : [])
    };

    onProgress?.('Generando copy con Gemini...');
    const copy = await generarCopy(promoNormalizada);

    onProgress?.('Generando imagen con Gemini...');
    const fondoDataUrl = await generarImagenFondo(promoNormalizada);

    onProgress?.('Componiendo imagen final...');
    const blob = await componerImagen(fondoDataUrl, copy, promoNormalizada);

    onProgress?.('Subiendo a la nube...');
    const url = await subirImagen(blob, promoNormalizada.id);

    return url;
}
