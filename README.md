# Paridad bidimensional: simulador del código producto

**Teoría de Códigos (MAT 4215), Universidad del Norte · Proyecto final, corte 4 · Grupo 7**
**Profesor:** MSc. Iván Y. Gómez G.

## Integrantes

- María José Sánchez Mercado
- Dariana Sanguino Cuello
- Luis Maldonado Cano
- Adolfo Moises Frias

## Tema

**Tema 7: Paridad bidimensional.** Los datos se ordenan en una matriz de k × m bits y se agrega un bit de paridad a cada fila, a cada columna y una esquina. El resultado es un **código producto** de dos códigos de paridad con parámetros:

| Longitud n | Dimensión (bits de datos) | Redundancia | Tasa R | Distancia mínima d |
|---|---|---|---|---|
| (k+1)(m+1) | k·m | k+m+1 | k·m / ((k+1)(m+1)) | 4 |

Con d = 4 el código **corrige 1 error** (un error hace fallar exactamente una fila y una columna, y su cruce lo ubica) y **detecta hasta 3**. Dos errores en la misma fila se detectan pero no se corrigen; tres en forma de L se "corrigen" mal; cuatro en las esquinas de un rectángulo pasan sin ser detectados.

El aplicativo cumple los cuatro requisitos: **codificador** (texto → ASCII de 7 bits → matriz con paridades, `backend/app/encoding.py` y `parity.py`), **canal** (1 error, 2 en una fila, diagonal, L, rectángulo, errores al azar o voltear una celda a mano, `errors.py`), **decodificador** (revisa filas y columnas, ubica el cruce y corrige, `decoder.py`) y **métrica** (Monte Carlo sobre un canal binario simétrico, `analysis.py`). El núcleo es propio; solo se usan librerías para la API (FastAPI) y la interfaz (React).

## Cómo ejecutarlo

Requisitos: **Python 3.11 o superior** y **Node.js 20 o superior** (en el PATH).

En Windows, abrir PowerShell en la carpeta `simulador-paridad` y escribir:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

En macOS o Linux: `./iniciar.sh`.

La primera vez crea el entorno de Python e instala las dependencias (tarda un par de minutos). Luego abrir **http://127.0.0.1:5173** en el navegador. `Ctrl+C` detiene todo.

**Demo:** escribir un texto → «Convertir a ASCII» → paridad por columnas → por filas → inyectar 1 error → «Revisar paridades» → «Corregir ese bit». Probar también los errores en la misma fila, en L, en rectángulo y al azar, y la simulación Monte Carlo.

Pruebas automáticas (opcional): `cd backend` y `.venv\Scripts\python -m pytest -q`. Incluyen la comprobación por fuerza bruta de que d = 4. Detalles técnicos, API y despliegue en `DESARROLLO.md`.

## Resultados principales

Monte Carlo con p = 0,01 (probabilidad de voltear cada bit) y bloques de 16 bits de datos:

| Esquema | Bits enviados | Correcto | Detectado | Error silencioso |
|---|---|---|---|---|
| Sin código | 16 | 85,1 % | — | **14,9 %** |
| Producto 4×4 (solo detectar) | 25 | 77,8 % | 22,2 % | ≈ 0 % |
| Producto 4×4 (corregir 1) | 25 | **97,4 %** | 2,5 % | **0,03 %** |
| Hamming (7,4) × 4 | 28 | 99,2 % | — | 0,8 % |

- Sin código, casi 1 de cada 7 bloques llega dañado sin que nadie lo note. Con el código producto corrigiendo, los errores silenciosos bajan de 14,9 % a 0,03 % (unas 500 veces menos).
- Con los mismos 16 bits de datos, el producto 4×4 tiene **tasa 0,64** (25 bits) frente a **0,57** de Hamming (7,4)×4 (28 bits), y además d = 4 frente a d = 3: Hamming corrige un poco más de bloques, pero cuando falla lo hace en silencio (0,8 %).
- Con textos de L letras la tasa es R = 7L / (8(L+1)) (0,78 con 8 letras, 0,84 con 24), pero d sigue en 4: un bloque más grande acumula más errores y es más probable que no se puedan corregir.

## Declaración de herramientas utilizadas

- **Lenguajes y librerías:** Python con FastAPI, Pydantic y Uvicorn (API); React, TypeScript, Vite y Framer Motion (interfaz y animaciones); pytest y Playwright (pruebas). El codificador, el canal, el decodificador y la simulación son código propio.
- **Inteligencia artificial:** Claude (Anthropic), usado como apoyo para programar el aplicativo, preparar las diapositivas y el guion, y redactar este README. Todos los integrantes revisaron el código del núcleo y pueden explicarlo.
- **Fuentes:** Hamming (1950); Elias (1954); MacWilliams y Sloane (1977); Lin y Costello (2004); material del curso MAT 4215. Citadas completas en la última diapositiva.
