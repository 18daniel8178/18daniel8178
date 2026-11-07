# NoiseArea — indicador MQL5 (MetaTrader 5)

Dibuja la estrategia **Noise Area** del paper *Beat the Market: An Effective Intraday Momentum
Strategy for S&P500 ETF (SPY)* (Zarattini, Aziz y Barbon, 2024) y muestra en un panel los checks
de entrada y salida en tiempo real. **Nunca abre, modifica ni cierra ordenes**: simula la posicion
del dia solo para saber que mostrar. Mas adelante un EA puede leerlo con `iCustom` (ver buffers).

Archivos:

| Archivo | Que es |
| --- | --- |
| `NoiseArea.mq5` | El indicador. |
| `tools/noise_area_check.py` | Referencia independiente en Python para recalcular a mano sigma, bandas, VWAP y senales de un dia a partir de un CSV M1 exportado de MT5. |

## Instalacion

1. Copia `NoiseArea.mq5` a `<Datos de MT5>\MQL5\Indicators\` (en MT5: *Archivo > Abrir carpeta de datos*).
2. Abre MetaEditor, abre el archivo y pulsa **Compilar** (F7). Debe terminar con `0 error(s), 0 warning(s)`.
3. En MT5, arrastra *NoiseArea* desde el Navegador a un grafico **M1 a M30** del simbolo (US500, US100, etc.).
4. Si quieres alertas push, activa las notificaciones en *Herramientas > Opciones > Notificaciones* y pon `InpPush = true`.

La primera vez puede tardar en descargar el historial M1: el panel muestra `Cargando historial...`
y reintenta solo, sin bloquear el terminal.

## Inputs

| Input | Default | Que hace |
| --- | --- | --- |
| `InpLookbackDays` | 14 | Sesiones anteriores para calcular la sigma. |
| `InpVolMultiplier` | 1.0 | Multiplicador del ancho del area (VM del paper). |
| `InpServerToNYHours` | 7 | Horas que el servidor va **adelantado** respecto a Nueva York. El panel muestra ambos relojes para comprobarlo. |
| `InpSessionStart` / `InpSessionEnd` | 09:30 / 16:00 | Sesion regular, hora de NY. Debe durar como maximo 390 minutos. |
| `InpFirstCheck` / `InpLastCheck` | 10:00 / 15:30 | Primer y ultimo chequeo, hora de NY. |
| `InpCheckEveryMin` | 30 | Minutos entre chequeos. |
| `InpFlatTime` | 15:58 | Hora de NY a la que se cierra la posicion simulada. |
| `InpMaxDailyLossPct` | 2.0 | Perdida diaria maxima para el check de riesgo (0 = desactivado). |
| `InpUseNewsCheck` | true | Aviso de noticias de alto impacto (no bloquea). |
| `InpNewsWindowMin` | 2 | Minutos antes y despues de la noticia. |
| `InpNewsCurrency` | USD | Moneda de las noticias a vigilar. |
| `InpDaysToDraw` | 10 | Sesiones hacia atras que se dibujan (incluida la de hoy). |
| `InpAlerts` / `InpPush` | true / false | Alerta en pantalla / notificacion push al haber senal. |
| `InpVerboseLog` | true | Imprime en *Expertos* los valores de verificacion (ver abajo). |
| Colores y grosores | — | Bandas, relleno, VWAP, stop, flechas, lineas verticales y panel. `InpArrowShiftPx` separa las flechas de la vela; si aparecen al lado contrario en tu build, pon un valor negativo. |

## Definiciones implementadas

Todo se calcula con velas **M1** del simbolo (`CopyRates(_Symbol, PERIOD_M1, ...)`), sea cual sea la
temporalidad del grafico.

- **Hora NY** = hora del servidor − `InpServerToNYHours`.
- **Sesion**: 9:30–16:00 NY, lunes a viernes, solo dias con datos. Minuto T es la hora de cierre de
  una vela M1 (de 9:31 a 16:00). La vela que abre a las 9:59 cierra a las 10:00 y es la del chequeo de las 10:00.
- **O** = apertura de la vela de las 9:30 (si falta esa vela, la primera disponible de la sesion).
  **PrevClose** = cierre de la ultima vela de la sesion anterior.
- **Sigma_T** = promedio de |C_T / O − 1| en las `InpLookbackDays` sesiones anteriores a la del dia.
  Hueco de datos en el minuto T: se usa el ultimo cierre disponible antes de T. Sesion que cerro temprano:
  se excluye del promedio en los minutos que no tiene. Se calcula una vez por sesion (390 valores) y
  solo se recalcula al cambiar de dia o al recargarse el historial.
- **UB_T** = max(O, PrevClose) × (1 + VM × sigma_T); **LB_T** = min(O, PrevClose) × (1 − VM × sigma_T).
- **VWAP** de sesion desde las 9:30 = Σ(precio tipico × volumen) / Σ(volumen), precio tipico = (H+L+C)/3 de cada
  vela M1. En CFDs el volumen es el **volumen de ticks**, asi que el VWAP es una aproximacion: el paper uso el
  volumen real de SPY.
- **Chequeos** a las :00 y :30 entre el primer y ultimo chequeo. El precio del chequeo es C_T y se evalua
  cuando esa vela M1 ya ha cerrado (al aparecer la vela siguiente). Entre chequeos no se decide nada.
- **Simulacion** en cada chequeo, en este orden: (1) salida: larga y C_T < max(UB_T, VWAP_T) → sale; corta y
  C_T > min(LB_T, VWAP_T) → sale. (2) entrada si no hay posicion (aunque acabe de salir): C_T > UB_T y
  C_T > VWAP_T → largo; C_T < LB_T y C_T < VWAP_T → corto. (3) a `InpFlatTime` cierra todo.

## Panel

Esquina superior izquierda. Cada check muestra OK (verde), NO (rojo) o `--` (gris, no aplica) y los valores
que lo justifican. Los valores son **en vivo** (precio actual contra las bandas del minuto en curso); la decision
simulada se toma solo con el cierre de la vela del chequeo.

1. **Hora valida**: es :00 o :30 entre 10:00 y 15:30 NY. Cuenta regresiva al proximo chequeo y ultimo chequeo evaluado.
2. **Precio fuera del area**: precio, UB, LB y distancia en puntos a cada banda. Tambien cuantas sesiones entran en la sigma.
3. **Lado correcto del VWAP**: precio y VWAP. `--` si el precio esta dentro del area.
4. **Sin posicion en esa direccion**: posicion simulada y posiciones reales abiertas en el simbolo (lotes L/S).
5. **Margen de riesgo del dia**: realizado hoy (deals cerrados desde la medianoche del **servidor**, con comision y swap)
   + flotante de toda la cuenta, en % del balance al inicio del dia. NO si supera `InpMaxDailyLossPct`. FTMO cuenta el
   dia en CE(S)T, igual que su servidor.
6. **Noticias** (solo aviso): evento de alto impacto de `InpNewsCurrency` dentro de ±`InpNewsWindowMin` min, con el
   calendario economico de MQL5 (cache de 60 s). Sin calendario (Probador de estrategias) muestra `sin datos`.

Debajo, el **estado general** en letra grande: `SENAL DE COMPRA`, `SENAL DE VENTA`, `MANTENER LARGO` /
`MANTENER CORTO` (con el stop), `SALIR`, `SIN SENAL` o `FUERA DE HORARIO`. Se mantiene hasta el siguiente chequeo.
Una ultima linea avisa si el grafico es H1 o mayor, si hay pocas sesiones M1 o si es fin de semana.

## Que se dibuja

- UB y LB con relleno entre ambas (`DRAW_FILLING`), solo en sesion (`EMPTY_VALUE` fuera). El relleno de MT5 no
  admite transparencia real: usa un gris claro (`InpColorFill`) y, si quieres ver las velas encima, activa
  *Propiedades del grafico > Comun > Grafico en primer plano*.
- VWAP punteado. Stop dinamico (max(UB, VWAP) en largos, min(LB, VWAP) en cortos) mientras haya posicion simulada.
- Flechas: compra debajo de la vela, venta encima, punto en la salida (al precio C_T).
- Lineas verticales punteadas en cada chequeo del dia actual.
- Ultimas `InpDaysToDraw` sesiones. En temporalidades mayores a M1, cada vela del grafico toma el valor del minuto
  en que cierra; la vela en formacion toma el ultimo minuto disponible. De M1 a M30; en H1 o mayor el panel avisa.

## Buffers para `iCustom`

| Indice | Contenido | Vacio |
| --- | --- | --- |
| 0 | UB (copia para el relleno) | `EMPTY_VALUE` |
| 1 | LB (copia para el relleno) | `EMPTY_VALUE` |
| 2 | **UB** banda superior | `EMPTY_VALUE` |
| 3 | **LB** banda inferior | `EMPTY_VALUE` |
| 4 | **VWAP** de sesion | `EMPTY_VALUE` |
| 5 | **Stop dinamico** (solo con posicion simulada) | `EMPTY_VALUE` |
| 6 | Flecha compra (precio = minimo de la vela) | `EMPTY_VALUE` |
| 7 | Flecha venta (precio = maximo de la vela) | `EMPTY_VALUE` |
| 8 | Punto de salida (precio = C_T) | `EMPTY_VALUE` |
| 9 | **Senal** en la vela del chequeo: `+1` compra, `-1` venta, `2` salida, `0` nada. Si en el mismo chequeo sale y reentra, vale la entrada (`+1`/`-1`) y el buffer 8 marca la salida. | `0` |
| 10 | **Posicion simulada** tras esa vela: `+1`, `-1`, `0` | `0` |
| 11 | Sigma_T del minuto | `EMPTY_VALUE` |

La senal se asigna a la vela del grafico que contiene la vela M1 del chequeo (en M1–M30 con chequeos a :00/:30 es la
vela que cierra justo a esa hora). Un EA debe leer la vela **cerrada** (shift 1 en el grafico donde cierra el
chequeo) y actuar en su primer tick, igual que hace la simulacion.

Ejemplo (los inputs van en el orden de la tabla de arriba; se pueden omitir los ultimos y quedan por defecto):

```mql5
int h = iCustom(_Symbol, PERIOD_M1, "NoiseArea",
                14, 1.0,                    // lookback, VM
                7, "09:30", "16:00",        // offset servidor-NY, sesion
                "10:00", "15:30", 30, "15:58");
double sig[1], pos[1], stop[1];
CopyBuffer(h, 9, 1, 1, sig);    // senal de la ultima vela cerrada
CopyBuffer(h, 10, 1, 1, pos);   // posicion simulada
CopyBuffer(h, 5, 1, 1, stop);   // stop dinamico
```

## Limitaciones

- `InpServerToNYHours` es fijo. Si tu servidor sigue la hora de Europa (EET/EEST, lo habitual en FTMO), la diferencia
  con NY es 7 h casi todo el ano pero **6 h** entre el cambio horario europeo y el americano (unas 2–3 semanas en
  marzo y en octubre–noviembre). Comprueba los dos relojes del panel y ajusta el input esos dias.
- Volumen de ticks en lugar de volumen real: el VWAP difiere del de SPY.
- Las sesiones son las que tiene el feed del broker: si el CFD cotiza en un feriado de NY sin volumen real, esa sesion
  entra igual en la sigma.
- La sigma necesita `InpLookbackDays` sesiones completas de M1; si el broker da menos historial, el panel avisa y usa
  las que haya.
- El check de riesgo usa el dia del servidor, no el de NY.
- El calendario economico no esta disponible en el Probador ni en algunas cuentas; entonces muestra `sin datos`.
- El indicador se recalcula una vez por minuto (nueva vela M1) y el panel una vez por segundo. En el primer tick del
  minuto se evaluan los chequeos; si el terminal estaba cerrado a esa hora, al abrirlo se reconstruye el dia completo.

## Verificacion

1. **Compilar** en MetaEditor: `0 error(s), 0 warning(s)`. El codigo se reviso con un chequeo sintactico externo, pero
   la compilacion real solo puede hacerse en MetaEditor; si saliera algun aviso, copia la linea exacta.
2. **Prints al cargar**. Con `InpVerboseLog = true`, en la pestana *Expertos* aparece para el dia actual: O, PrevClose y,
   para 10:00, 10:30, 12:00 y 15:30, la sigma (y cuantas sesiones la componen), UB, LB, C_T y VWAP. Tambien la lista de
   componentes |C_T/O − 1| de la sigma de las 10:30, sesion por sesion, y una linea por cada chequeo evaluado
   (`Chequeo 10:30 NY | C_T=... UB=... LB=... VWAP=... -> accion: ...`).
3. **Recalcular la sigma a mano**. Exporta el M1 del simbolo (*Ver > Simbolos > Barras*, elige el rango y *Exportar*)
   y ejecuta:

   ```bash
   python3 tools/noise_area_check.py --csv US500_M1.csv --date 2026-11-05 --offset 7 --time 10:30
   ```

   Imprime los mismos bloques que el indicador (O, PrevClose, tabla 10:00/10:30/12:00/15:30, componentes de la sigma y
   simulacion chequeo a chequeo). Los 14 valores |C/O − 1| se pueden promediar con una calculadora y deben dar la sigma
   del indicador. Con un CSV sintetico la referencia reprodujo el promedio manual (0.001076), excluyo una sesion con
   cierre temprano del promedio de las 15:30 y rellenó un hueco de datos con el ultimo cierre anterior a T.
4. **Comparar con "Concretum Bands" de TradingView** (mismo dia, grafico M1 o M5 del CFD o de SPY/ES):
   pon en TradingView lookback 14 y multiplicador 1.0, sesion regular. Compara UB/LB a las 10:00, 12:00 y 15:30 y el
   VWAP. Diferencias de unos pocos puntos son normales: el feed del CFD no es el de SPY, el volumen de ticks no es el
   volumen real (afecta al VWAP), y Concretum puede usar como PrevClose el cierre oficial de las 16:00 mientras aqui se
   usa la ultima vela M1 de la sesion del broker. Las bandas deben tener la misma forma (ensanchandose a lo largo del dia)
   y los cruces de los chequeos deben coincidir en direccion.
5. **Probador de estrategias en modo visual**: *Ver > Probador de estrategias*, pestana *Ajustes*, selecciona el
   indicador *NoiseArea*, el simbolo, M5, modo *Cada tick basado en ticks reales* o *OHLC 1 minuto*, un rango que
   incluya al menos 15 sesiones antes del dia a revisar, marca *Modo visual*. Observa un dia de tendencia (debe entrar
   en el primer chequeo que cierre fuera del area y del lado correcto del VWAP y mantener mientras C_T siga por encima
   de max(UB, VWAP)) y un dia lateral (sin entradas, o entradas que salen en el chequeo siguiente). El panel de noticias
   mostrara `sin datos` y el de riesgo la cuenta del probador.

## Fuera de alcance

No abre ordenes. No cambia los parametros del paper ni anade filtros (medias, RSI, etc.).
