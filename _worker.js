/**
 * _worker.js - Cloudflare Worker Proxy para AutoTécnico PRO
 * 
 * Este archivo resuelve problemas de CORS permitiendo que la aplicación
 * consuma la API de Anthropic desde Cloudflare Pages.
 * 
 * INSTALACIÓN:
 * 1. Copia este archivo en la raíz de tu repo (mismo nivel que index.html)
 * 2. Asegúrate que wrangler.toml existe en la raíz
 * 3. Git push a tu repo
 * 4. En la app, URL proxy: "/__cf_cron/api/proxy?url="
 * 
 * USO EN LA APP:
 * - URL Proxy: https://tu-dominio.pages.dev/api/proxy?url=
 * - O en local: http://localhost:8787/api/proxy?url=
 */

export default {
  async fetch(request, env, ctx) {
    // Solo permitir POST (para llamadas a API)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // Validar que se proporcionó URL
    if (!targetUrl) {
      return new Response(JSON.stringify({
        error: {
          message: 'Parámetro "url" requerido. Uso: /?url=https%3A%2F%2Fapi.anthropic.com%2F...'
        }
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Validar que sea HTTPS y de Anthropic (seguridad)
    try {
      const target = new URL(decodeURIComponent(targetUrl));
      if (target.protocol !== 'https:') {
        return new Response(JSON.stringify({
          error: { message: 'Solo HTTPS permitido' }
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({
        error: { message: 'URL inválida' }
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      // Construir la solicitud hacia Anthropic
      const decodedUrl = decodeURIComponent(targetUrl);
      
      // Copiar headers del request original (excluyendo algunos)
      const headers = new Headers(request.headers);
      headers.delete('host'); // Remover host del navegador
      headers.delete('origin'); // Remover origin del navegador

      // Hacer la llamada al servidor real (Anthropic)
      const response = await fetch(decodedUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });

      // Copiar la respuesta y añadir headers CORS
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });

      // Añadir headers CORS permisivos
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access');
      newResponse.headers.set('Access-Control-Expose-Headers', '*');

      return newResponse;

    } catch (error) {
      console.error('[Worker] Error:', error);
      
      return new Response(JSON.stringify({
        error: {
          type: 'server_error',
          message: `Error en proxy: ${error.message}`
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
