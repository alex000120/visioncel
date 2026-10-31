# Gesto Player · Reproductor con control por gestos

Reproductor de 5 videos a pantalla completa que se controla con las manos a distancia, usando la cámara (detección y seguimiento con MediaPipe Hands, todo en el navegador).

## Estructura

```
index.html          → página principal
css/styles.css      → diseño
js/config.js        → videos, gestos, perfiles de rendimiento  ← editar aquí
js/gestures.js      → reconocimiento de gestos
js/settings.js      → ajustes guardados por dispositivo
js/player.js        → reproductor
js/vision.js        → cámara + IA + mini cámara
js/pointer.js       → cursor con la mano y clic por pellizco
js/ui.js            → barra, listas, panel de ajustes
js/app.js           → une todo y define las acciones de cada gesto
videos/             → coloca aquí video1.mp4 … video5.mp4
```

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `gesto-player`).
2. Sube todo el contenido de esta carpeta, incluida `videos/` con los 5 archivos.
3. Ve a **Settings → Pages**, en *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
4. Abre la URL que aparece (`https://TU-USUARIO.github.io/gesto-player/`). GitHub Pages usa HTTPS, que es obligatorio para la cámara.

Cada video debe pesar menos de 100 MB (límite de GitHub). Para mejor fluidez usa MP4 H.264 de 720p o 1080p.

## Gestos

| Gesto | Función |
|---|---|
| ☝️ Índice levantado | Mueve el puntero (modo mouse) |
| 🤏 Pellizco | Clic. Mantenerlo y mover arrastra barras y listas |
| ✋ Palma quieta | Reproducir / pausar |
| 👋 Palma deslizando | Adelantar o retroceder 10 s |
| ✊ Puño | Silenciar / activar sonido |
| ✌️ Índice + medio | Siguiente video |
| 3️⃣ Índice + medio + anular | Video anterior |
| 👍 / 👎 | Subir / bajar volumen |
| 🤘 Índice + meñique | Abrir / cerrar ajustes |
| 🤙 Pulgar + meñique | Pantalla completa |

Consejos: buena luz frontal, mano a 40–80 cm de la cámara, y mantén el gesto un instante (el tiempo se ajusta en Ajustes).

## Rendimiento por dispositivo

En **Ajustes → Dispositivo** se elige un perfil (Auto, Ultra, Alto, Medio, Bajo, Ahorro). La opción *Auto* detecta el equipo. Cada dispositivo guarda sus propios ajustes en su navegador.

## Notas

- La pantalla completa desde gesto depende del navegador; si lo bloquea, usa el botón ⛶ o la tecla F.
- Si no hay cámara, la app funciona igual con mouse y teclado.
- Teclado: Espacio, ← →, ↑ ↓, M, N, B, S, F, L, Esc.
