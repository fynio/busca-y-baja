# Busca & Baja

> Buscador y agregador local de **música sin copyright** (Creative Commons) en un solo lugar.

![st](https://img.shields.io/badge/licencia_del_proyecto-personal_(sin_reventa)-53FC18?style=flat-square&labelColor=0a0c09)
![st2](https://img.shields.io/badge/plataformas_Agregadas-5-53FC18?style=flat-square&labelColor=0a0c09)
![st3](https://img.shields.io/badge/dependencias-0_%C2%B5_npm-53FC18?style=flat-square&labelColor=0a0c09)

---

## 🎧 Objetivo del proyecto

**El objetivo es tener TU biblioteca musical, corriendo en TU máquina, lista para tus streams.**

¿Por qué un **servidor local** y no otra página web más? Porque el uso real detrás de este proyecto es
armar sets de música para las transmisiones y los videos sin depender de servicios de streaming
(que se cortan, no bajás el archivo, y encima te exponen a strikes de copyright en pleno directo):

- **Guards todo en disco local** (`music/`): tus temas quedan tuyos, funcionan sin internet y sin
  "sesión iniciada", listos para arrastrar al reproductor de OBS, cortar al editor oFatherlayer.
- **Legal de punta a punta**: todo el catálogo viene de repos con licencia **Creative Commons /
  dominio público** — con la guía de licencias a la vista decidís en segundos qué suena en un canal
  monetizado y qué no.
- **Un solo lugar**: ccMixter, Wikimedia, Jamendo, Freesound e Internet Archive en una sola interfaz.
  Cero pestañas, cero revisar cinco sitios para encontrar un beat.
- **Como es tuyo y corre en tu máquina**: no hay cuentas, no hay tracking, no hay "premium".
  El server es tuyo.

### ¿Cómo funciona (arquitectura en 4 líneas)?

```
navegador (interfaz) → tus clicks → servidor Node local (puerto 5177)
        ↙ busca en los repos (5 APIs, sin keys normalmente)   ↘ descarga el MP3 → carpeta music/
```

El browser hace pedidos al `localhost`; el server habla con los repos (unifica formatos,
mete una cola anti-throttle, cachea respuestas 10 minutos y hace proxy del audio para que
el preview y la descarga siempre funcionen). Vos solo escuchás y bajás.

### ¿Qué ya tenés hecho? (estado actual)

- ✅ **Servidor Node puro** — cero dependencias `npm`, arranca en 1 comando
- ✅ **Cuatro motores propios sin API key**: ccMixter (tags reales), Wikimedia Commons
  (duración + licencia parseadas), Internet Archive netlabels (~66.000 lanzamientos con MP3 directo),
  Jamendo vía Openverse
- ✅ **Interfaz con tu marca** (RGT): fondo `#050604`, verde Kick `#53fc18`, firma SVG real,
  Outfit + JetBrains Mono, diagonales al 115° y halos
- ✅ **Lista con 20+ temas por repositorio** al entrar (sin escribir nada)
- ✅ **Categorías**: Chill, Ambient, Electrónica, Rock, Pop, Hip‑Hop, Jazz, Clásica, Instrumental…
- ✅ **Reproductor fijo** con preview de streaming real (soporte Range, no bloquea la navegación)
- ✅ **Descarga a un clic** a `music/` con nomenclatura `Autor - Título.mp3` sin colisiones
- ✅ **Filtros de licencia** para uso comercial / modificación — para canales que generan dinero
- ✅ **Panel de archivos** descargados (listar y borrar) vía API

Lo único opcional: una **API key gratis** de Openverse para que Jamendo/Freesound no tengan
límite horario (ver abajo — 2 minutos de configuración).

---

## ▶ ▶ ▶ 【 CÓMO EJECUTAR 】

```bash
# 1. entra a la carpeta del proyecto
cd /Users/fynio/Pages/MUSICA_PARA_VIDEOS

# 2. administra el motor (no hay nada que instalar: Node puro)
node server.js
# → Music aggregator on http://localhost:5177
```

3. abrí en el navegador: **http://localhost:5177**
4. la app carga sola ~40 temas al entrar — no tenés que escribir nada para empezar a escuchar y bajar música.

> Para apagar el servidor: `Ctrl + C` en la terminal donde corre.
> La primera vez sin conexión a internet la lista estará vacía (toda la música viene de repos remotos).

---

## 🧱 ¿Qué incluye?

| Repositorio | Motor propio | Sin API key | Detalle |
|---|---|---|---|
| **ccMixter** | propio | ✅ límites: ninguno | comunidad remix; filtro por tags reales |
| **Wikimedia Commons** | propio (bypass Openverse) | ✅ límites: ninguno | archivos de audio con licencia CC + duración real |
| **Internet Archive** (*netlabels*) | propio | ✅ límites: ninguno | ~66.000 lanzamientos netlabel con MP3 directo |
| **Jamendo** | vía Openverse | ⚠️ uso anónimo | carátulas reales; la key gratis lo carga full |
| **Freesound** | vía Openverse | ⚠️ uso anónimo | igual que arriba |

> ⚠️ **Nota**: **Free Music Archive** ya no existe como proveedor de Openverse (el slug `fma` devuelve
> 400 desde 2026) — el expansor equivalente en el stack es Internet Archive/netlabels.

Extras de interfaz:
- **Chips por plataforma + categorías** (Chill, Ambient, Electrónica, Rock, Hip‑Hop, Jazz, Clásica…)
- **Vista de lista** con carátula, autor, duración, badge de fuente y **badge de licencia CC**
- **Reproductor fijo abajo** — buscás y automaescuchás sin cortar la reproducción
- Filtro por **uso comercial** permitido y **modificación** permitida
- Botón `↗` por tema → abre la página original para el **crédito correcto al autor**

---

## 🔓 Cómo levantar el límite de Openverse

Openverse (`api.openverse.org`) mantiene un límite horario anónimo: si acosás el server con
búsquedas seguidas, el upstream empieza a responder lento o directamente se corta. Solución:

1. Creá una cuenta **gratis** en [api.openverse.org](https://api.openverse.org)
2. Copiá tu API key
3. Pegala en [`config.json`](./config.json):

```json
{ "openverseKey": "TU_KEY_ACÁ" }
```

Con la key, Jamendo y Freesound responden siempre. El resto de los motores (ccMixter,
Wikimedia, Internet Archive) **no la necesitan en ningún caso**.

---

## 📖 Guía corta de licencias (leela 20 segundos)

| Badge | Significado | ¿Canal monetizado (YouTube/Kick)? |
|---|---|---|
| `CC0` | dominio público | ✅ sin pedir nada |
| `CC by` | usar + atribuir autor | ✅ con crédito en la descripción |
| `CC by-sa` | como `by`, tu remix queda CC | ✅ con crédito |
| `CC by-nc` | **no comercial** | ❌ solo contenido sin monetización |
| `CC by-nc-nd` | no comercial + sin remixes | ❌ y ni sí toques el audio |

**Regla prática**: planificás subir algo que genere dinero → filtrá por `Uso comercial permitido`
en el selector superior y listo.

---

## 🗂 Estructura del proyecto

```
MUSICA_PARA_VIDEOS/
├── server.js           → servidor Node puro (2+ motores, proxy de stream/descarga, caché 10 min)
├── public/
│   └── index.html      → interfaz completa (buscador, filtros, lista, reproductor, footer)
├── config.json         → API key opcional de Openverse
├── music/              → acá caen los MP3 que bajás (se genera sola)
└── README.md           → este archivo
```

### Endpoints expuestos (por si querés scriptear)

| Endpoint | Qué hace |
|---|---|
| `GET /api/search?engine=…&q=…&genre=…&source=…` | búsqueda unificada |
| `GET /api/stream?url=…` | preview de audio (soporta Range) |
| `GET /api/download?url=…&name=…` | descarga a `music/` con nombre + anti‑colisión |
| `GET /api/files` · `POST /api/delete?name=…` | listar y borrar lo descargado |

---

## 🖥 Marca

La interfaz viste el trabajo de **@rodrigofynio**:
fondo `#050604`, verde Kick `#53fc18`, tinta `#eef4e6`, tipografías **Outfit + JetBrains Mono**,
monograma SVG con líneas *rails*, diagonales al 115° y halos verdes — los mismos tokens
de los stingers animados de la marca en [`~/Pages/animacion_para_stream`](../animacion_para_stream/README.md).

---

## 👤 Creador

**Rodrigo García Trejo — rodrigofynio**

<p align="center">
  <a href="https://kick.com/rodrigofynio">
    <img alt="Kick" src="https://img.shields.io/badge/Directo_en_Kick-rodrigofynio-53FC18?style=flat-square&logo=kick&logoColor=white&labelColor=0a0c09" />
  </a>
</p>

> Transmisiones de música, coding y contenido al 🟢 **todas las semanas en [kick.com/rodrigofynio](https://kick.com/rodrigofynio)** — ¡seguí el canal y participá!

---

<div align="center">
  <em>Diseñado y ejecutado por <b>rodrigofynio</b> — material legal, local y sin drama ©</em>
</div>
