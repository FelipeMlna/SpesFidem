# Guía de Seguridad y HTTPS - Spesfidem Aluminio

Para que tu página sea segura y muestre el candado (**HTTPS**), debes activar un certificado SSL. Como el código ya está optimizado, aquí tienes las 3 mejores formas de hacerlo según dónde publiques tu web:

## Opción 1: Usar Cloudflare (Recomendado y Gratis) 🛡️
Es la forma más fácil y rápida. No necesitas instalar nada en tu servidor.
1. Crea una cuenta gratuita en [Cloudflare.com](https://www.cloudflare.com).
2. Agrega tu dominio (ej: spesfidem.com).
3. Cambia los DNS en tu registrador de dominio por los que te dé Cloudflare.
4. En la pestaña **SSL/TLS**, activa la opción **"Flexible"** o **"Full"**.
5. ¡Listo! Cloudflare pondrá el candado automáticamente.

## Opción 2: Panel de Hosting (cPanel / Hostinger / GoDaddy) 🏢
Si pagas un hosting mensual, la mayoría ya incluye SSL gratis.
1. Entra a tu panel de control.
2. Busca la sección **SSL/TLS** o **Let's Encrypt**.
3. Dale clic al botón **"Instalar"** o **"Activar SSL"** para tu dominio.
4. Asegúrate que la opción **"Forzar HTTPS"** esté activa.

## Opción 3: Servidor Propio (VPS / Linux) 🐧
Si manejas tu propio servidor con Certbot:
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

> [!IMPORTANT]
> **Nota de Seguridad**: El código de la web ya está preparado. No hay enlaces "inseguros" (http) internos que bloqueen el candado. Una vez actives el SSL en tu hosting, el sitio funcionará perfectamente con HTTPS.

> [!TIP]
> Si deseas probar HTTPS en tu computadora localmente para pruebas técnicas, he dejado un script llamado `serve_https.py` en la carpeta raíz (requiere generar certificados locales).
