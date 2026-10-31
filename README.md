# Busca & Baja

> Buscador y agregador local de **música sin copyright** (Creative Commons) todo en un solo lugar.

![st](https://img.shields.io/badge/licencia_del_proyecto-personal_(sin_reventa)-53FC18?style=flat-square&labelColor=0a0c09)
![st2](https://img.shields.io/badge/plataformas_agregadas-5-53FC18?style=flat-square&labelColor=0a0c09)
![st3](https://img.shields.io/badge/dependencias-0_npm-53FC18?style=flat-square&labelColor=0a0c09)

---

## 🎧 Objetivo del proyecto

**La meta sería tener TU propia discoteca rodando en TU compu, lista para los streams. ¿Por qué? Porque sí.**

¿Por qué un **servidor local** y no otra web más? Porque el chiste real de este proyecto es
armar sets de música para las transmisiones y los videos sin depender de servicios de streaming
(que se cortan, no te dejan bajar el archivo y encima te pueden tumbar el directo por copyright):

- **Guardas todo en tu disco** (`music/`): los temas quedan tuyos, funcionan sin internet y
  sin "sesión iniciada", listos para arrastrarlos al reproductor de OBS, al editor o a donde sea.
- **Legal de punta a punta**: todo el catálogo viene de repos con licencia **Creative Commons /
  dominio público** — la guía de licencias que trae la app te dice en segundos qué suena en un
  canal monetizado y qué no.
- **Un solo lugar**: ccMixter, Wikimedia, Jamendo, Freesound e Internet Archive en una sola interfaz.
  Cero pestañas, cero estar truena en cinco sitios pa' encontrar un beat.
- **Todo corre en tu máquina**: no hay cuentas, no hay tracking, no hay "premium". El server es tuyo.

### ¿Cómo funciona (arquitectura en dos líneas)?

```
navegador (interfaz) → tus clicks → servidor Node local (puerto 5177)
        ↙ busca en los repos (5 APIs, casi todas sin key)    ↘ descarga el MP3 → carpeta music/
```

El navegadore hace pedidos al `localhost`; el server platica con los repos (unifica formatos,
mete una cola anti-throttle, cachea respuestas 10 minutos y hace proxy del audio para que
el preview y la descarga funcionen siempre). Tú nadaıcás escuchas y bajas.

### ¿Qué ya tienes hecho? (estado actual)

- ✅ **Servidor Node puro** — cero dependencias `npm`, arranca con 1 comando
- ✅ **Cuatro motores propios sin API key**: ccMixter (tags reales), Wikimedia Commons
  (duración + licencia ya parseadas), Internet Archive netlabels (~66.000 lanzamientos
  con MP3 directo), Jamendo vía Openverse
- ✅ **Interfaz con tu marca** (RGT): fondo `#050604`, verde Kick `#53fc18`, firma SVG real,
  Outfit + JetBrains Mono, diagonales al 115° y halos verdes
- ✅ **Lista con 20+ temas por repositorio** apenas entras (sin escribir nada)
- ✅ **Categorías**: Chill, Ambient, Electrónica, Rock, Pop, Hip‑Hop, Jazz, Clásica, Instrumental…
- ✅ **Reproductor fijo abajo** con preview de streaming real (soporta Range, no interrumpe nada)
- ✅ **Descarga a un clic** a `music/` con nombre `Autor - Título.mp3` sin chocar archivos
- ✅ **Filtros de licencia** para uso comercial / modificación — pa' los canales que generan dinero
- ✅ **Panel de archivos** descargados (listar y borrar) vía API

Lo único opcional: una **API key gratis** de Openverse para que Jamendo/Freesound no tengan
límite horario (ver abajo — 2 minutos de configuración).

---

## ▶ ▶ ▶ 【 CÓMO EJECUTAR 】

> **Requisito único**: tener Node 18 o más nuevo (los demás, nada — cero dependencias npm).
> Verificalo con `node --version`; si no lo tienes, bájalo de [nodejs.org](https://nodejs.org)
> (instalador gráfico en Windows/macOS, o el maneja de tu distro en Linux).

```bash
# 1. clona el repo (en la carpeta que tú quieras — el proyecto no fija ninguna ruta)
git clone https://github.com/fynio/busca-y-baja.git busca-y-baja

# 2. entra a la carpeta que se creó
cd busca-y-baja

# 3. prende el motor
node server.js
# → Music aggregator on http://localhost:5177
```

4. abre el navegador: **http://localhost:5177**
5. la app carga sola ~40 temás apenas entras — no necesitas escribir nada para empezar a escuchar y bajar música.

> ⚠️ **Windows**: usa PowerShell o CMD (los comandos son los mismos). Funciona en las tres
> plataformas porque es Node puro: macOS ✅ · Linux ✅ · Windows ✅.
> La carpeta `music/` se crea sola al vuelo en **la carpeta donde corre el server** —
> sin configurar absolutamento nada por sistema operativo.
> Para apagar: `Ctrl + C` en la terminal donde corre.
> Si no hay internet, la lista se queda vacía: toda la música vive en repos remotos.

### Si no tienes idea de qué es una terminal

1. Instala Node de [nodejs.org](https://nodejs.org) (siguiente, siguiente, instalar).
2. Abre la terminal:
   - **macOS**: app "Terminal" (Cmd+Espacio → escribe "Terminal")
   - **Windows**: menú inicio → escribe "PowerShell"
   - **Linux**: `Ctrl+Alt+T` o la app "Terminal" de tu distro
3. Pega los 3 comandos de arriba uno por uno y Enter después de cada uno.
4. Abre tu navegador y vete a `http://localhost:5177` — listo.

---

## 🧱 ¿Qué incluye?

| Repositorio | Motor propio | Sin API key | Detalle |
|---|---|---|---|
| **ccMixter** | propio | ✅ sin límites | comunidad de remixes; filtro por tags reales |
| **Wikimedia Commons** | propio (bypass Openverse) | ✅ sin límites | archivos de audio CC + duración real |
| **Internet Archive** (*netlabels*) | propio | ✅ sin límites | ~66.000 lanzamientos netlabel con MP3 directo |
| **Jamendo** | vía Openverse | ⚠️ uso anónimo | carátulas reales; la key lo deja al 100 |
| **Freesound** | vía Openverse | ⚠️ uso anónimo | igual que arriba |

> ⚠️ **Nota**: **Free Music Archive** ya no existe como proveedor de Openverse (el slug `fma`
> regresa un 400 desde 2026) — el equivalente libre en el stack es Internet Archive/netlabels.

Extras de la interfaz:
- **Chips por plataforma + categorías** (Chill, Ambient, Electrónica, Rock, Hip‑Hop, Jazz, Clásica…)
- **Vista de lista** con carátula, autor, duración, badge de fuente y **badge de licencia CC**
- **Reproductor fijo abajo** — navegas y bajas sin cortar la rola
- Filtro por **uso comercial** permitido y **modificación** permitida
- Botón `↗` por tema → abre la página original para ponerle el **crédito correcto al autor**

---

## 🔓 Cómo quitarte el límite de Openverse

Openverse (`api.openverse.org`) tiene un límite horario para usuarios anónimos: si picas al
server con búsquedas seguidas, el upstream se pone lento o se corta. La solución es gratis
y tarda 2 minutos:

1. Créate una cuenta **gratis** en [api.openverse.org](https://api.openverse.org)
2. Copia tu API key
3. Pégala en [`config.json`](./config.json):

```json
{ "openverseKey": "TU_KEY_AQUI" }
```

Con la key, Jamendo y Freesound responden siempre. Los demás motores (ccMixter,
Wikimedia, Internet Archive) **no la necesitan ni shuffle**.

---

## 📖 Guía de licencias en 20 segundos

| Badge | Significado | ¿Canal monetizado (YouTube/Kick)? |
|---|---|---|
| `CC0` | dominio público | ✅ sin pedir nada |
| `CC by` | usar + atribuir al autor | ✅ con crédito en la descripción |
| `CC by-sa` | como `by`, tu remix queda CC | ✅ con crédito |
| `CC by-nc` | **no comercial** | ❌ solo contenido sin monetización |
| `CC by-nc-nd` | no comercial + sin remixes | ❌ ni que estuviera pintado |

**Regla práctica**: si el contenido genera dinero → filtra por `Uso comercial permitido`
en el selector de arriba y de ahí en adelante, sin pedos.

---

## 🗂 Estructura del proyecto

```
busca-y-baja/
├── server.js           → servidor Node puro (2+ motores, proxy de stream/descarga, caché 10 min)
├── public/
│   └── index.html      → interfaz completa (buscador, filtros, lista, reproductor, footer)
├── config.json         → API key opcional de Openverse
├── music/              → aquí caen las MP3 que bajas (se genera sola)
└── README.md           → este archivo
```

### Endpoints expuestos (por si quieres scriptear)

| Endpoint | Qué hace |
|---|---|
| `GET /api/search?engine=…&q=…&genre=…&source=…` | búsqueda unificada |
| `GET /api/stream?url=…` | preview de audio (soporta Range) |
| `GET /api/download?url=…&name=…` | descarga a `music/` con nombre + anti‑colisión |
| `GET /api/files` · `POST /api/delete?name=…` | listar y borrar lo descargado |

---

## 👤 Creador

**Rodrigo García Trejo — rodrigofynio**

<p align="center">
  <a href="https://kick.com/rodrigofynio">
    <img alt="Kick" src="https://img.shields.io/badge/Directo_en_Kick-rodrigofynio-53FC18?style=flat-square&logo=kick&logoColor=white&labelColor=0a0c09" />
  </a>
</p>

> Transmisiones de música, coding y contenido al 🟢 **todas las semanas en [kick.com/rodrigofynio](https://kick.com/rodrigofynio)** — sigue el canal, métete al directo y particiona.

---

<div align="center">
  <em>Diseñado y ejecutado por <b>rodrigofynio</b> — material legal, local y sin drama ©</em>
</div>
