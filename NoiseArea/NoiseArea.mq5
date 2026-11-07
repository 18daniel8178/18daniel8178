//+------------------------------------------------------------------+
//|                                                    NoiseArea.mq5 |
//|  Noise Area intraday momentum (Zarattini, Aziz & Barbon, 2024)   |
//|  "Beat the Market: An Effective Intraday Momentum Strategy for   |
//|   S&P500 ETF (SPY)"                                               |
//|                                                                  |
//|  Indicador de solo lectura: NUNCA abre, modifica ni cierra       |
//|  ordenes. Simula la posicion del dia para mostrar el panel.      |
//+------------------------------------------------------------------+
#property copyright   "Daniel - uso personal"
#property version     "1.00"
#property description "Noise Area (Zarattini/Aziz/Barbon 2024): bandas, VWAP, stop dinamico y panel de checks."
#property description "Trabaja internamente con velas M1 del simbolo del grafico. No opera."
#property indicator_chart_window
#property indicator_buffers 12
#property indicator_plots   8

//--- plot 0: relleno del area (buffers 0 y 1)
#property indicator_label1  "Noise Area UB;Noise Area LB"
#property indicator_type1   DRAW_FILLING
#property indicator_color1  clrGainsboro,clrGainsboro
//--- plot 1: banda superior (buffer 2)
#property indicator_label2  "UB"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrDodgerBlue
#property indicator_style2  STYLE_SOLID
#property indicator_width2  1
//--- plot 2: banda inferior (buffer 3)
#property indicator_label3  "LB"
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrDodgerBlue
#property indicator_style3  STYLE_SOLID
#property indicator_width3  1
//--- plot 3: VWAP (buffer 4)
#property indicator_label4  "VWAP"
#property indicator_type4   DRAW_LINE
#property indicator_color4  clrOrange
#property indicator_style4  STYLE_DOT
#property indicator_width4  1
//--- plot 4: stop dinamico (buffer 5)
#property indicator_label5  "Stop"
#property indicator_type5   DRAW_LINE
#property indicator_color5  clrRed
#property indicator_style5  STYLE_DASH
#property indicator_width5  1
//--- plot 5: flecha compra (buffer 6)
#property indicator_label6  "Compra"
#property indicator_type6   DRAW_ARROW
#property indicator_color6  clrLime
#property indicator_width6  1
//--- plot 6: flecha venta (buffer 7)
#property indicator_label7  "Venta"
#property indicator_type7   DRAW_ARROW
#property indicator_color7  clrRed
#property indicator_width7  1
//--- plot 7: punto de salida (buffer 8)
#property indicator_label8  "Salida"
#property indicator_type8   DRAW_ARROW
#property indicator_color8  clrGold
#property indicator_width8  1
//--- buffers 9, 10, 11: calculo (senal, posicion simulada, sigma)

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "Estrategia (parametros del paper)"
input int    InpLookbackDays     = 14;      // Sesiones anteriores para la sigma
input double InpVolMultiplier    = 1.0;     // Multiplicador del ancho del area (VM)

input group "Horario (hora de Nueva York)"
input int    InpServerToNYHours  = 7;       // Horas que el servidor va adelantado a NY
input string InpSessionStart     = "09:30"; // Inicio sesion regular
input string InpSessionEnd       = "16:00"; // Fin sesion regular
input string InpFirstCheck       = "10:00"; // Primer chequeo
input string InpLastCheck        = "15:30"; // Ultimo chequeo
input int    InpCheckEveryMin    = 30;      // Minutos entre chequeos
input string InpFlatTime         = "15:58"; // Cierre de la posicion simulada

input group "Riesgo y noticias"
input double InpMaxDailyLossPct  = 2.0;     // Perdida diaria maxima % (0 = desactivado)
input bool   InpUseNewsCheck     = true;    // Aviso de noticias de alto impacto
input int    InpNewsWindowMin    = 2;       // Minutos antes/despues de la noticia
input string InpNewsCurrency     = "USD";   // Moneda de las noticias

input group "Dibujo y alertas"
input int    InpDaysToDraw       = 10;      // Dias hacia atras que se dibujan
input bool   InpAlerts           = true;    // Alerta en pantalla al haber senal
input bool   InpPush             = false;   // Notificacion push al haber senal
input bool   InpVerboseLog       = true;    // Imprimir valores de verificacion en Expertos

input group "Colores y grosores"
input color  InpColorUB          = clrDodgerBlue;    // Banda superior
input color  InpColorLB          = clrDodgerBlue;    // Banda inferior
input int    InpWidthBands       = 1;                // Grosor bandas
input color  InpColorFill        = C'225,225,225';   // Relleno del area
input color  InpColorVWAP        = clrOrange;        // VWAP
input int    InpWidthVWAP        = 1;                // Grosor VWAP
input color  InpColorStop        = clrRed;           // Stop dinamico
input int    InpWidthStop        = 1;                // Grosor stop
input color  InpColorBuy         = clrLime;          // Flecha compra
input color  InpColorSell        = clrRed;           // Flecha venta
input color  InpColorExit        = clrGold;          // Punto de salida
input int    InpArrowSize        = 1;                // Grosor flechas
input int    InpArrowShiftPx     = 10;               // Separacion de flechas (px)
input color  InpColorVLine       = clrDimGray;       // Lineas verticales de chequeo
input color  InpPanelBg          = C'18,18,28';      // Fondo del panel
input color  InpPanelBorder      = clrDimGray;       // Borde del panel
input color  InpPanelText        = clrWhite;         // Texto del panel
input color  InpPanelValues      = clrSilver;        // Valores del panel
input int    InpPanelFontSize    = 9;                // Tamano de letra del panel
input int    InpPanelX           = 10;               // Posicion X del panel
input int    InpPanelY           = 20;               // Posicion Y del panel

//+------------------------------------------------------------------+
//| Constantes                                                       |
//+------------------------------------------------------------------+
#define MAX_SLOTS      390          // minutos de la sesion regular (9:30-16:00)
const string PFX = "NA_";          // prefijo de todos los objetos del indicador
#define PANEL_FONT     "Consolas"
#define SIG_NONE       0
#define SIG_BUY        1
#define SIG_SELL       -1
#define SIG_EXIT       2

//+------------------------------------------------------------------+
//| Una sesion regular (un dia de NY)                                |
//| Slot s = minuto de apertura de la vela M1 menos minuto de inicio |
//| de sesion. La vela del slot s cierra en T = inicio + s + 1 min.  |
//+------------------------------------------------------------------+
struct Session
  {
   datetime nyDate;              // medianoche NY del dia
   datetime firstTime;           // hora servidor de la primera vela
   double   open;                // O: apertura de la primera vela (9:30)
   double   prevClose;           // cierre de la ultima vela de la sesion anterior
   bool     prevValid;
   int      firstSlot;
   int      lastSlot;            // ultimo slot con vela real
   int      lastCompletedSlot;   // ultimo slot cuya vela ya cerro
   bool     computed;            // sigma/bandas/simulacion calculadas
   double   close[MAX_SLOTS];    // C_T (relleno hacia adelante en huecos)
   bool     avail[MAX_SLOTS];    // hay dato para el slot (real o rellenado)
   double   vwap[MAX_SLOTS];
   double   sigma[MAX_SLOTS];
   int      sigmaN[MAX_SLOTS];   // sesiones usadas en la sigma del slot
   double   ub[MAX_SLOTS];
   double   lb[MAX_SLOTS];
   int      pos[MAX_SLOTS];      // posicion simulada tras el slot
   double   stop[MAX_SLOTS];
   int      sig[MAX_SLOTS];      // 0, +1, -1, 2
   bool     exitDot[MAX_SLOTS];
   int      lastCheckSlot;       // ultimo chequeo evaluado
   int      lastCheckSig;
  };

//+------------------------------------------------------------------+
//| Buffers                                                          |
//+------------------------------------------------------------------+
double g_bufFillUB[];   // 0
double g_bufFillLB[];   // 1
double g_bufUB[];       // 2
double g_bufLB[];       // 3
double g_bufVWAP[];     // 4
double g_bufStop[];     // 5
double g_bufBuy[];      // 6
double g_bufSell[];     // 7
double g_bufExit[];     // 8
double g_bufSignal[];   // 9
double g_bufPos[];      // 10
double g_bufSigma[];    // 11

//+------------------------------------------------------------------+
//| Estado global                                                    |
//+------------------------------------------------------------------+
Session  g_sess[];
int      g_nSess        = 0;
int      g_firstDrawK   = 0;         // primera sesion que se dibuja/calcula
int      g_todayK       = -1;        // indice de la sesion de hoy (-1 si no hay)
datetime g_todayDate    = 0;         // medianoche NY de "hoy"
datetime g_lastM1Time   = 0;         // vela M1 en formacion en el ultimo rebuild
bool     g_ready        = false;     // historial cargado y calculado
bool     g_forceFull    = true;
int      g_loadAttempts = 0;
string   g_histStatus   = "";
datetime g_lastAlerted  = 0;         // hora servidor de la ultima senal alertada
bool     g_firstBuild   = true;
datetime g_vlDate       = 0;         // dia para el que existen las lineas verticales
datetime g_printedDate  = 0;         // dia para el que ya se imprimio la verificacion
datetime g_lastLoggedCheck = 0;      // ultimo chequeo registrado en el log
datetime g_lastFullTime = 0;         // hora del ultimo rebuild completo
uint     g_lastPanelTick = 0;        // throttle del panel en OnCalculate
uint     g_lastAttemptTick = 0;      // throttle de reintentos de carga

// minutos de NY parseados de los inputs
int      g_startMin = 570, g_endMin = 960, g_firstCheckMin = 600, g_lastCheckMin = 930, g_flatMin = 958;
int      g_slots    = 390;
int      g_flatSlot = 387;
bool     g_isCheck[MAX_SLOTS];

// noticias
bool     g_newsAvailable = false;
datetime g_newsRefreshed = 0;
datetime g_newsTime[];
string   g_newsName[];

// panel
int      g_panelRows = 11;

//+------------------------------------------------------------------+
//| Utilidades de tiempo                                             |
//+------------------------------------------------------------------+
int IMax(const int a, const int b) { return (a > b) ? a : b; }
int IMin(const int a, const int b) { return (a < b) ? a : b; }

datetime ToNY(const datetime srv)
  {
   return (datetime)((long)srv - (long)InpServerToNYHours * 3600);
  }
datetime ToServer(const datetime ny)
  {
   return (datetime)((long)ny + (long)InpServerToNYHours * 3600);
  }
datetime DateOf(const datetime t)      { return (datetime)((long)t - (long)(t % 86400)); }
int      MinuteOfDay(const datetime t) { return (int)((t % 86400) / 60); }
int      SecondOfDay(const datetime t) { return (int)(t % 86400); }

bool IsWeekday(const datetime ny)
  {
   MqlDateTime st;
   TimeToStruct(ny, st);
   return (st.day_of_week >= 1 && st.day_of_week <= 5);
  }

// "HH:MM" -> minutos del dia, -1 si invalido
int ParseHHMM(const string s)
  {
   string parts[];
   ushort sep = StringGetCharacter(":", 0);
   if(StringSplit(s, sep, parts) != 2) return -1;
   int h = (int)StringToInteger(parts[0]);
   int m = (int)StringToInteger(parts[1]);
   if(h < 0 || h > 23 || m < 0 || m > 59) return -1;
   return h * 60 + m;
  }

string MinToHHMM(const int m)
  {
   return StringFormat("%02d:%02d", m / 60, m % 60);
  }

// slot de la vela que CIERRA en el minuto m (chequeo a las m)
int SlotClosingAt(const int m) { return m - g_startMin - 1; }
// minuto NY en que cierra la vela del slot s
int CloseMinOfSlot(const int s) { return g_startMin + s + 1; }

string P(const double v) { return DoubleToString(v, _Digits); }

//+------------------------------------------------------------------+
//| OnInit                                                           |
//+------------------------------------------------------------------+
int OnInit()
  {
//--- validar inputs de horario
   g_startMin      = ParseHHMM(InpSessionStart);
   g_endMin        = ParseHHMM(InpSessionEnd);
   g_firstCheckMin = ParseHHMM(InpFirstCheck);
   g_lastCheckMin  = ParseHHMM(InpLastCheck);
   g_flatMin       = ParseHHMM(InpFlatTime);
   if(g_startMin < 0 || g_endMin < 0 || g_firstCheckMin < 0 || g_lastCheckMin < 0 || g_flatMin < 0)
     {
      Print("NoiseArea: formato de hora invalido. Usa HH:MM.");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_slots = g_endMin - g_startMin;
   if(g_slots <= 0 || g_slots > MAX_SLOTS)
     {
      Print(StringFormat("NoiseArea: la sesion debe durar entre 1 y %d minutos (ahora %d).", MAX_SLOTS, g_slots));
      return INIT_PARAMETERS_INCORRECT;
     }
   if(InpLookbackDays < 1 || InpDaysToDraw < 1 || InpCheckEveryMin < 1 || InpVolMultiplier <= 0.0)
     {
      Print("NoiseArea: InpLookbackDays, InpDaysToDraw, InpCheckEveryMin deben ser >= 1 y InpVolMultiplier > 0.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(g_firstCheckMin <= g_startMin || g_lastCheckMin < g_firstCheckMin || g_flatMin <= g_lastCheckMin || g_flatMin > g_endMin)
     {
      Print("NoiseArea: se requiere inicio < primer chequeo <= ultimo chequeo < hora de cierre <= fin de sesion.");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_flatSlot = SlotClosingAt(g_flatMin);
   for(int s = 0; s < MAX_SLOTS; s++) g_isCheck[s] = false;
   for(int m = g_firstCheckMin; m <= g_lastCheckMin; m += InpCheckEveryMin)
     {
      int s = SlotClosingAt(m);
      if(s >= 0 && s < g_slots) g_isCheck[s] = true;
     }

//--- buffers
   SetIndexBuffer(0,  g_bufFillUB, INDICATOR_DATA);
   SetIndexBuffer(1,  g_bufFillLB, INDICATOR_DATA);
   SetIndexBuffer(2,  g_bufUB,     INDICATOR_DATA);
   SetIndexBuffer(3,  g_bufLB,     INDICATOR_DATA);
   SetIndexBuffer(4,  g_bufVWAP,   INDICATOR_DATA);
   SetIndexBuffer(5,  g_bufStop,   INDICATOR_DATA);
   SetIndexBuffer(6,  g_bufBuy,    INDICATOR_DATA);
   SetIndexBuffer(7,  g_bufSell,   INDICATOR_DATA);
   SetIndexBuffer(8,  g_bufExit,   INDICATOR_DATA);
   SetIndexBuffer(9,  g_bufSignal, INDICATOR_CALCULATIONS);
   SetIndexBuffer(10, g_bufPos,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(11, g_bufSigma,  INDICATOR_CALCULATIONS);
   ArraySetAsSeries(g_bufFillUB, false);
   ArraySetAsSeries(g_bufFillLB, false);
   ArraySetAsSeries(g_bufUB, false);
   ArraySetAsSeries(g_bufLB, false);
   ArraySetAsSeries(g_bufVWAP, false);
   ArraySetAsSeries(g_bufStop, false);
   ArraySetAsSeries(g_bufBuy, false);
   ArraySetAsSeries(g_bufSell, false);
   ArraySetAsSeries(g_bufExit, false);
   ArraySetAsSeries(g_bufSignal, false);
   ArraySetAsSeries(g_bufPos, false);
   ArraySetAsSeries(g_bufSigma, false);

   for(int p = 0; p < 8; p++) PlotIndexSetDouble(p, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 0, InpColorFill);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 1, InpColorFill);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, InpColorUB);
   PlotIndexSetInteger(1, PLOT_LINE_WIDTH, InpWidthBands);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, InpColorLB);
   PlotIndexSetInteger(2, PLOT_LINE_WIDTH, InpWidthBands);
   PlotIndexSetInteger(3, PLOT_LINE_COLOR, InpColorVWAP);
   PlotIndexSetInteger(3, PLOT_LINE_WIDTH, InpWidthVWAP);
   PlotIndexSetInteger(3, PLOT_LINE_STYLE, STYLE_DOT);
   PlotIndexSetInteger(4, PLOT_LINE_COLOR, InpColorStop);
   PlotIndexSetInteger(4, PLOT_LINE_WIDTH, InpWidthStop);
   PlotIndexSetInteger(4, PLOT_LINE_STYLE, STYLE_DASH);
   PlotIndexSetInteger(5, PLOT_LINE_COLOR, InpColorBuy);
   PlotIndexSetInteger(5, PLOT_LINE_WIDTH, InpArrowSize);
   PlotIndexSetInteger(5, PLOT_ARROW, 233);                 // flecha arriba
   PlotIndexSetInteger(5, PLOT_ARROW_SHIFT, InpArrowShiftPx);   // debajo de la vela
   PlotIndexSetInteger(6, PLOT_LINE_COLOR, InpColorSell);
   PlotIndexSetInteger(6, PLOT_LINE_WIDTH, InpArrowSize);
   PlotIndexSetInteger(6, PLOT_ARROW, 234);                 // flecha abajo
   PlotIndexSetInteger(6, PLOT_ARROW_SHIFT, -InpArrowShiftPx);  // encima de la vela
   PlotIndexSetInteger(7, PLOT_LINE_COLOR, InpColorExit);
   PlotIndexSetInteger(7, PLOT_LINE_WIDTH, InpArrowSize + 1);
   PlotIndexSetInteger(7, PLOT_ARROW, 159);                 // punto
   PlotIndexSetInteger(7, PLOT_ARROW_SHIFT, 0);

   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   IndicatorSetString(INDICATOR_SHORTNAME, StringFormat("NoiseArea(%d, %.2f)", InpLookbackDays, InpVolMultiplier));

//--- panel
   if(!CreatePanel())
     {
      Print("NoiseArea: no se pudo crear el panel.");
      return INIT_FAILED;
     }

   g_ready        = false;
   g_forceFull    = true;
   g_loadAttempts = 0;
   g_firstBuild   = true;
   g_histStatus   = "Cargando historial...";
   g_nSess        = 0;
   ArrayResize(g_sess, 0);

   EventSetTimer(1);
   Print(StringFormat("NoiseArea iniciado en %s %s. Offset servidor-NY = %d h. Sesion NY %s-%s, chequeos %s-%s cada %d min, cierre %s.",
                      _Symbol, EnumToString(_Period), InpServerToNYHours, InpSessionStart, InpSessionEnd,
                      InpFirstCheck, InpLastCheck, InpCheckEveryMin, InpFlatTime));
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//| OnDeinit                                                         |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   ObjectsDeleteAll(0, PFX);
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| OnCalculate                                                      |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   if(rates_total < 2) return 0;
   ArraySetAsSeries(time, false);

   if(prev_calculated == 0)
     {
      ClearBuffers(0, rates_total);
      g_forceFull = true;
     }

   datetime curM1 = iTime(_Symbol, PERIOD_M1, 0);
   if(curM1 == 0)
     {
      g_ready      = false;
      g_histStatus = "Cargando historial M1...";
      UpdatePanel();
      return rates_total;
     }

   bool newMinute = (curM1 != g_lastM1Time);
   bool rebuilt   = false;
   if(!g_ready || g_forceFull || newMinute)
     {
      // mientras carga el historial, reintentar como mucho una vez por segundo
      bool attempt = g_ready || (GetTickCount() - g_lastAttemptTick >= 1000);
      if(attempt)
        {
         g_lastAttemptTick = GetTickCount();
         if(Rebuild())
           {
            WriteBuffers(time, rates_total);
            g_lastM1Time = curM1;
            rebuilt = true;
           }
        }
     }
   // el panel se refresca como mucho una vez por segundo (OnTimer lo hace cada segundo)
   if(rebuilt || GetTickCount() - g_lastPanelTick >= 1000)
     {
      g_lastPanelTick = GetTickCount();
      UpdatePanel();
     }
   return rates_total;
  }

//+------------------------------------------------------------------+
//| OnTimer: cuenta regresiva, panel y reintento de carga            |
//+------------------------------------------------------------------+
void OnTimer()
  {
   if(!g_ready)
     {
      // reintento sin bloquear: CopyRates dispara la descarga del historial
      datetime curM1 = iTime(_Symbol, PERIOD_M1, 0);
      if(curM1 > 0 && Rebuild())
        {
         WriteBuffersFromTimer();
         g_lastM1Time = curM1;
        }
     }
   else
     {
      // cambio de dia NY sin tick (fin de semana, pre-market): recalcular
      datetime today = DateOf(ToNY(TimeCurrent()));
      if(today != g_todayDate) g_forceFull = true;
      datetime curM1 = iTime(_Symbol, PERIOD_M1, 0);
      if(g_forceFull && curM1 > 0 && Rebuild())
        {
         WriteBuffersFromTimer();
         g_lastM1Time = curM1;
        }
     }
   UpdatePanel();
  }

//+------------------------------------------------------------------+
//| Rebuild: completo (todas las sesiones) o solo el dia de hoy      |
//+------------------------------------------------------------------+
bool Rebuild()
  {
   datetime now   = TimeCurrent();
   datetime today = DateOf(ToNY(now));
   bool full = g_forceFull || !g_ready || today != g_todayDate;
   if(!full)
     {
      if(g_todayK < 0)
        {
         // todavia no hay sesion de hoy: solo reconstruir si ya deberia haber empezado
         datetime nyNow = ToNY(now);
         bool started = IsWeekday(nyNow) && MinuteOfDay(nyNow) >= g_startMin;
         if(started && (long)now - (long)g_lastFullTime >= 300) full = true;
        }
      else if(!UpdateToday()) full = true;   // actualizacion incremental de hoy
     }
   if(full)
     {
      if(!BuildAll()) return false;
      g_lastFullTime = now;
     }
   g_todayDate = today;
   g_forceFull = false;
   g_ready     = true;
   EnsureVLines();
   PrintVerification();
   CheckAlerts();
   return true;
  }

//+------------------------------------------------------------------+
//| Inicializa una sesion vacia                                      |
//+------------------------------------------------------------------+
void InitSession(Session &S, const datetime nyDate)
  {
   S.nyDate            = nyDate;
   S.firstTime         = 0;
   S.open              = 0.0;
   S.prevClose         = 0.0;
   S.prevValid         = false;
   S.firstSlot         = -1;
   S.lastSlot          = -1;
   S.lastCompletedSlot = -1;
   S.computed          = false;
   S.lastCheckSlot     = -1;
   S.lastCheckSig      = SIG_NONE;
   for(int s = 0; s < MAX_SLOTS; s++)
     {
      S.close[s]   = 0.0;
      S.avail[s]   = false;
      S.vwap[s]    = 0.0;
      S.sigma[s]   = 0.0;
      S.sigmaN[s]  = 0;
      S.ub[s]      = EMPTY_VALUE;
      S.lb[s]      = EMPTY_VALUE;
      S.pos[s]     = 0;
      S.stop[s]    = EMPTY_VALUE;
      S.sig[s]     = SIG_NONE;
      S.exitDot[s] = false;
     }
  }

//+------------------------------------------------------------------+
//| Anade una vela M1 a la sesion (con relleno de huecos y VWAP)     |
//+------------------------------------------------------------------+
void AddBar(Session &S, const int slot, const MqlRates &r, double &cumPV, double &cumV, const bool forming)
  {
   if(S.firstSlot < 0)
     {
      S.firstSlot = slot;
      S.firstTime = r.time;
      S.open      = r.open;
     }
   // huecos: ultimo cierre disponible antes de T (solo si ya hubo una vela)
   if(S.lastSlot >= 0)
     {
      for(int s = S.lastSlot + 1; s < slot; s++)
        {
         S.close[s] = S.close[S.lastSlot];
         S.vwap[s]  = S.vwap[S.lastSlot];
         S.avail[s] = true;
        }
     }
   double tp  = (r.high + r.low + r.close) / 3.0;
   double vol = (double)r.tick_volume;
   cumPV += tp * vol;
   cumV  += vol;
   S.close[slot] = r.close;
   S.avail[slot] = true;
   S.vwap[slot]  = (cumV > 0.0) ? cumPV / cumV : tp;
   S.lastSlot    = slot;
   S.lastCompletedSlot = forming ? slot - 1 : slot;
  }

//+------------------------------------------------------------------+
//| Copia todo el historial M1 necesario y construye las sesiones    |
//+------------------------------------------------------------------+
bool BuildAll()
  {
   int needSessions = InpLookbackDays + InpDaysToDraw + 2;
   int calDays      = (int)MathCeil(needSessions * 7.0 / 5.0) + 7;
   datetime now     = TimeCurrent();
   datetime start   = (datetime)((long)now - (long)calDays * 86400);
   MqlRates r[];
   ArraySetAsSeries(r, false);
   int n = CopyRates(_Symbol, PERIOD_M1, start, now + 60, r);
   if(n <= 0)
     {
      g_loadAttempts++;
      g_histStatus = StringFormat("Cargando historial M1... (intento %d, error %d)", g_loadAttempts, GetLastError());
      return false;
     }
   datetime curM1 = iTime(_Symbol, PERIOD_M1, 0);

   ArrayResize(g_sess, 0);
   int k = -1;
   double cumPV = 0.0, cumV = 0.0;
   for(int i = 0; i < n; i++)
     {
      datetime ny = ToNY(r[i].time);
      int slot    = MinuteOfDay(ny) - g_startMin;
      if(slot < 0 || slot >= g_slots) continue;
      if(!IsWeekday(ny)) continue;
      datetime d = DateOf(ny);
      if(k < 0 || g_sess[k].nyDate != d)
        {
         k = ArrayResize(g_sess, k + 2, 16) - 1;
         InitSession(g_sess[k], d);
         cumPV = 0.0;
         cumV  = 0.0;
        }
      MqlRates rr = r[i];
      AddBar(g_sess[k], slot, rr, cumPV, cumV, (rr.time == curM1));
     }
   g_nSess = ArraySize(g_sess);

   // historial todavia descargandose?
   if(g_nSess < InpLookbackDays + 1 && g_loadAttempts < 30 && (long)r[0].time > (long)start + 3 * 86400)
     {
      g_loadAttempts++;
      g_histStatus = StringFormat("Cargando historial M1... (%d sesiones, intento %d)", g_nSess, g_loadAttempts);
      return false;
     }
   if(g_nSess < 2)
     {
      g_loadAttempts++;
      g_histStatus = StringFormat("Historial M1 insuficiente (%d sesiones)", g_nSess);
      return false;
     }

   // PrevClose
   for(int j = 0; j < g_nSess; j++)
     {
      if(j > 0 && g_sess[j - 1].lastSlot >= 0)
        {
         g_sess[j].prevClose = g_sess[j - 1].close[g_sess[j - 1].lastSlot];
         g_sess[j].prevValid = true;
        }
     }

   // sesion de hoy
   datetime today = DateOf(ToNY(now));
   g_todayK = -1;
   if(g_sess[g_nSess - 1].nyDate == today) g_todayK = g_nSess - 1;

   // sesiones a dibujar: las ultimas InpDaysToDraw
   g_firstDrawK = IMax(0, g_nSess - InpDaysToDraw);
   for(int j = g_firstDrawK; j < g_nSess; j++)
     {
      ComputeSigma(j);
      ComputeBands(g_sess[j]);
      Simulate(g_sess[j]);
      g_sess[j].computed = true;
     }

   int usedN = (g_nSess >= InpLookbackDays + 1) ? InpLookbackDays : g_nSess - 1;
   g_histStatus = StringFormat("Historial: %d sesiones M1 | sigma con %d sesiones%s", g_nSess, usedN,
                               (usedN < InpLookbackDays) ? " (INSUFICIENTE)" : "");
   return true;
  }

//+------------------------------------------------------------------+
//| Actualizacion incremental de la sesion de hoy (cada minuto)      |
//+------------------------------------------------------------------+
bool UpdateToday()
  {
   if(g_todayK < 0 || g_todayK >= g_nSess) return false;
   Session S = g_sess[g_todayK];          // conserva sigma y prevClose
   datetime startSrv = ToServer((datetime)((long)S.nyDate + (long)g_startMin * 60));
   datetime now      = TimeCurrent();
   MqlRates r[];
   ArraySetAsSeries(r, false);
   int n = CopyRates(_Symbol, PERIOD_M1, startSrv, now + 60, r);
   if(n <= 0) return false;
   datetime curM1 = iTime(_Symbol, PERIOD_M1, 0);

   // reiniciar los datos del dia, conservando sigma/sigmaN/prevClose
   S.firstSlot = -1;
   S.lastSlot  = -1;
   S.lastCompletedSlot = -1;
   S.open = 0.0;
   for(int s = 0; s < MAX_SLOTS; s++)
     {
      S.close[s] = 0.0;
      S.avail[s] = false;
      S.vwap[s]  = 0.0;
     }
   double cumPV = 0.0, cumV = 0.0;
   for(int i = 0; i < n; i++)
     {
      datetime ny = ToNY(r[i].time);
      if(DateOf(ny) != S.nyDate) continue;
      int slot = MinuteOfDay(ny) - g_startMin;
      if(slot < 0 || slot >= g_slots) continue;
      MqlRates rr = r[i];
      AddBar(S, slot, rr, cumPV, cumV, (rr.time == curM1));
     }
   if(S.firstSlot < 0) return false;
   ComputeBands(S);
   Simulate(S);
   S.computed = true;
   g_sess[g_todayK] = S;
   return true;
  }

//+------------------------------------------------------------------+
//| Sigma_T = promedio de |C_T/O - 1| en las N sesiones anteriores   |
//+------------------------------------------------------------------+
void ComputeSigma(const int k)
  {
   for(int s = 0; s < g_slots; s++)
     {
      double sum = 0.0;
      int cnt = 0;
      for(int j = k - 1; j >= 0 && j >= k - InpLookbackDays; j--)
        {
         // sesion que cerro temprano: no tiene el minuto -> excluida para ese slot
         if(!g_sess[j].avail[s] || g_sess[j].open <= 0.0) continue;
         sum += MathAbs(g_sess[j].close[s] / g_sess[j].open - 1.0);
         cnt++;
        }
      g_sess[k].sigma[s]  = (cnt > 0) ? sum / cnt : 0.0;
      g_sess[k].sigmaN[s] = cnt;
     }
  }

//+------------------------------------------------------------------+
//| Bandas con ajuste por gap                                        |
//+------------------------------------------------------------------+
void ComputeBands(Session &S)
  {
   for(int s = 0; s < g_slots; s++)
     {
      if(S.sigmaN[s] > 0 && S.prevValid && S.open > 0.0)
        {
         double w = InpVolMultiplier * S.sigma[s];
         S.ub[s] = MathMax(S.open, S.prevClose) * (1.0 + w);
         S.lb[s] = MathMin(S.open, S.prevClose) * (1.0 - w);
        }
      else
        {
         S.ub[s] = EMPTY_VALUE;
         S.lb[s] = EMPTY_VALUE;
        }
     }
  }

//+------------------------------------------------------------------+
//| Simulacion de la posicion del dia (solo en velas M1 cerradas)    |
//+------------------------------------------------------------------+
void Simulate(Session &S)
  {
   int pos = 0;
   S.lastCheckSlot = -1;
   S.lastCheckSig  = SIG_NONE;
   for(int s = 0; s < g_slots; s++)
     {
      S.sig[s]     = SIG_NONE;
      S.exitDot[s] = false;
      S.pos[s]     = 0;
      S.stop[s]    = EMPTY_VALUE;
      if(s < S.firstSlot || s > S.lastSlot || !S.avail[s]) continue;
      bool bandsOk  = (S.ub[s] != EMPTY_VALUE);
      bool completed = (s <= S.lastCompletedSlot);
      if(completed)
        {
         if(s == g_flatSlot)
           {
            if(pos != 0) { pos = 0; S.sig[s] = SIG_EXIT; S.exitDot[s] = true; }
           }
         else if(g_isCheck[s] && bandsOk)
           {
            double c = S.close[s];
            double v = S.vwap[s];
            // 1) salida
            if(pos > 0 && c < MathMax(S.ub[s], v)) { pos = 0; S.sig[s] = SIG_EXIT; S.exitDot[s] = true; }
            else if(pos < 0 && c > MathMin(S.lb[s], v)) { pos = 0; S.sig[s] = SIG_EXIT; S.exitDot[s] = true; }
            // 2) entrada (tambien si acaba de salir)
            if(pos == 0)
              {
               if(c > S.ub[s] && c > v)      { pos = 1;  S.sig[s] = SIG_BUY; }
               else if(c < S.lb[s] && c < v) { pos = -1; S.sig[s] = SIG_SELL; }
              }
            S.lastCheckSlot = s;
            S.lastCheckSig  = S.sig[s];
           }
        }
      S.pos[s] = pos;
      if(pos != 0 && bandsOk)
         S.stop[s] = (pos > 0) ? MathMax(S.ub[s], S.vwap[s]) : MathMin(S.lb[s], S.vwap[s]);
     }
  }

//+------------------------------------------------------------------+
//| Busca la sesion (entre las dibujadas) con esa fecha NY           |
//+------------------------------------------------------------------+
int FindSession(const datetime nyDate)
  {
   for(int k = g_nSess - 1; k >= g_firstDrawK; k--)
      if(g_sess[k].nyDate == nyDate) return k;
   return -1;
  }

//+------------------------------------------------------------------+
//| Vacia los buffers en [from, to)                                  |
//+------------------------------------------------------------------+
void ClearBuffers(const int from, const int to)
  {
   for(int i = from; i < to; i++)
     {
      g_bufFillUB[i] = EMPTY_VALUE;
      g_bufFillLB[i] = EMPTY_VALUE;
      g_bufUB[i]     = EMPTY_VALUE;
      g_bufLB[i]     = EMPTY_VALUE;
      g_bufVWAP[i]   = EMPTY_VALUE;
      g_bufStop[i]   = EMPTY_VALUE;
      g_bufBuy[i]    = EMPTY_VALUE;
      g_bufSell[i]   = EMPTY_VALUE;
      g_bufExit[i]   = EMPTY_VALUE;
      g_bufSignal[i] = 0.0;
      g_bufPos[i]    = 0.0;
      g_bufSigma[i]  = EMPTY_VALUE;
     }
  }

//+------------------------------------------------------------------+
//| Primer indice de time[] con time >= t (busqueda binaria)         |
//+------------------------------------------------------------------+
int LowerBound(const datetime &time[], const int total, const datetime t)
  {
   int lo = 0, hi = total;
   while(lo < hi)
     {
      int mid = (lo + hi) / 2;
      if(time[mid] < t) lo = mid + 1; else hi = mid;
     }
   return lo;
  }

//+------------------------------------------------------------------+
//| Vuelca las sesiones en los buffers del grafico                   |
//| El valor de cada vela del grafico es el del minuto en que cierra |
//+------------------------------------------------------------------+
void WriteBuffers(const datetime &time[], const int total)
  {
   if(!g_ready || g_nSess == 0 || total <= 0) return;
   int psec = PeriodSeconds();
   int pmin = IMax(1, psec / 60);
   datetime curM1 = iTime(_Symbol, PERIOD_M1, 0);
   datetime oldest = g_sess[g_firstDrawK].firstTime;
   int startIdx = LowerBound(time, total, (datetime)((long)oldest - (long)psec));
   ClearBuffers(startIdx, total);

   for(int i = startIdx; i < total; i++)
     {
      datetime tc = (datetime)((long)time[i] + (long)psec - 60);   // vela M1 que cierra con esta vela
      if(i == total - 1 && tc > curM1) tc = curM1;              // vela en formacion: ultimo minuto
      datetime ny = ToNY(tc);
      datetime d  = DateOf(ny);
      int k = FindSession(d);
      if(k < 0) continue;
      int slot = MinuteOfDay(ny) - g_startMin;
      // slots que cubre la vela del grafico (para flechas)
      int slotLo = IMax(g_sess[k].firstSlot, slot - pmin + 1);
      int slotHi = IMin(g_sess[k].lastSlot, slot);
      int entry = SIG_NONE;
      bool exitDot = false;
      for(int s = slotLo; s <= slotHi; s++)
        {
         if(s < 0 || s >= g_slots) continue;
         if(g_sess[k].sig[s] == SIG_BUY || g_sess[k].sig[s] == SIG_SELL) entry = g_sess[k].sig[s];
         if(g_sess[k].exitDot[s]) exitDot = true;
        }
      // flechas: compra debajo de la vela, venta encima, punto de salida en C_T
      if(entry == SIG_BUY)       g_bufBuy[i]  = iLow(_Symbol, _Period, total - 1 - i);
      else if(entry == SIG_SELL) g_bufSell[i] = iHigh(_Symbol, _Period, total - 1 - i);
      if(exitDot)
        {
         for(int s = slotHi; s >= slotLo; s--)
            if(s >= 0 && s < g_slots && g_sess[k].exitDot[s]) { g_bufExit[i] = g_sess[k].close[s]; break; }
        }
      g_bufSignal[i] = (entry != SIG_NONE) ? (double)entry : (exitDot ? (double)SIG_EXIT : 0.0);

      if(slot < 0 || slot >= g_slots || slot < g_sess[k].firstSlot || slot > g_sess[k].lastSlot) continue;
      if(!g_sess[k].avail[slot]) continue;
      g_bufPos[i]   = (double)g_sess[k].pos[slot];
      g_bufSigma[i] = g_sess[k].sigma[slot];
      if(g_sess[k].ub[slot] != EMPTY_VALUE)
        {
         g_bufUB[i]     = g_sess[k].ub[slot];
         g_bufLB[i]     = g_sess[k].lb[slot];
         g_bufFillUB[i] = g_sess[k].ub[slot];
         g_bufFillLB[i] = g_sess[k].lb[slot];
        }
      g_bufVWAP[i] = g_sess[k].vwap[slot];
      g_bufStop[i] = g_sess[k].stop[slot];
     }
  }

//+------------------------------------------------------------------+
//| Escribe buffers desde OnTimer (sin time[] de OnCalculate)        |
//+------------------------------------------------------------------+
void WriteBuffersFromTimer()
  {
   int total = ArraySize(g_bufUB);
   if(total <= 0) return;
   datetime t[];
   ArraySetAsSeries(t, false);
   if(CopyTime(_Symbol, _Period, 0, total, t) != total) return;
   WriteBuffers(t, total);
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| Lineas verticales en los chequeos del dia actual                 |
//+------------------------------------------------------------------+
void EnsureVLines()
  {
   datetime today = g_todayDate;
   if(today == g_vlDate) return;
   ObjectsDeleteAll(0, PFX + "VL_");
   g_vlDate = today;
   if(!IsWeekday(today)) return;
   for(int m = g_firstCheckMin; m <= g_lastCheckMin; m += InpCheckEveryMin)
     {
      datetime srv = ToServer((datetime)((long)today + (long)m * 60));
      string name  = StringFormat("%sVL_%02d%02d", PFX, m / 60, m % 60);
      if(ObjectCreate(0, name, OBJ_VLINE, 0, srv, 0.0))
        {
         ObjectSetInteger(0, name, OBJPROP_COLOR, InpColorVLine);
         ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
         ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
         ObjectSetInteger(0, name, OBJPROP_BACK, true);
         ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
         ObjectSetString(0, name, OBJPROP_TOOLTIP, StringFormat("Chequeo %s NY", MinToHHMM(m)));
        }
     }
  }

//+------------------------------------------------------------------+
//| Registro de cada chequeo evaluado hoy (una linea por chequeo)    |
//+------------------------------------------------------------------+
void LogCheck(const int s)
  {
   if(!InpVerboseLog || g_todayK < 0 || s < 0 || s >= g_slots) return;
   datetime t = ToServer((datetime)((long)g_todayDate + (long)CloseMinOfSlot(s) * 60));
   if(t == g_lastLoggedCheck) return;
   g_lastLoggedCheck = t;
   int sig = g_sess[g_todayK].sig[s];
   string act = (sig == SIG_BUY) ? "COMPRA" : (sig == SIG_SELL) ? "VENTA" : (sig == SIG_EXIT) ? "SALIR" : "nada";
   if(sig != SIG_EXIT && g_sess[g_todayK].exitDot[s]) act = "SALIR + " + act;   // salida y reentrada en el mismo chequeo
   Print(StringFormat("Chequeo %s NY | C_T=%s UB=%s LB=%s VWAP=%s sigma=%.6f (%d ses.) | pos=%d -> accion: %s",
                      MinToHHMM(CloseMinOfSlot(s)), P(g_sess[g_todayK].close[s]),
                      (g_sess[g_todayK].ub[s] != EMPTY_VALUE) ? P(g_sess[g_todayK].ub[s]) : "n/d",
                      (g_sess[g_todayK].lb[s] != EMPTY_VALUE) ? P(g_sess[g_todayK].lb[s]) : "n/d",
                      P(g_sess[g_todayK].vwap[s]), g_sess[g_todayK].sigma[s], g_sess[g_todayK].sigmaN[s],
                      g_sess[g_todayK].pos[s], act));
  }

//+------------------------------------------------------------------+
//| Alertas: nueva senal en el ultimo chequeo evaluado de hoy        |
//+------------------------------------------------------------------+
void CheckAlerts()
  {
   if(g_todayK < 0) return;
   int s = g_sess[g_todayK].lastCheckSlot;
   int flat = g_flatSlot;
   // tambien el cierre forzado
   if(flat >= 0 && flat < g_slots && flat <= g_sess[g_todayK].lastCompletedSlot && g_sess[g_todayK].sig[flat] == SIG_EXIT && flat > s) s = flat;
   bool first = g_firstBuild;
   g_firstBuild = false;
   if(s < 0) return;
   int sig = g_sess[g_todayK].sig[s];
   datetime sigTime = ToServer((datetime)((long)g_todayDate + (long)CloseMinOfSlot(s) * 60));
   LogCheck(s);
   if(first)
     {
      g_lastAlerted = sigTime;    // no alertar senales viejas al cargar
      return;
     }
   if(sig == SIG_NONE || sigTime == g_lastAlerted) return;
   g_lastAlerted = sigTime;
   if((long)TimeCurrent() - (long)sigTime > 180) return;   // senal vieja (p.ej. historial recargado)
   if(!InpAlerts && !InpPush) return;
   string what = (sig == SIG_BUY) ? "SENAL DE COMPRA" : (sig == SIG_SELL) ? "SENAL DE VENTA" : "SALIR";
   string msg = StringFormat("NoiseArea %s %s NY: %s | C=%s UB=%s LB=%s VWAP=%s", _Symbol, MinToHHMM(CloseMinOfSlot(s)), what,
                             P(g_sess[g_todayK].close[s]), P(g_sess[g_todayK].ub[s]), P(g_sess[g_todayK].lb[s]), P(g_sess[g_todayK].vwap[s]));
   if(InpAlerts) Alert(msg);
   if(InpPush && !SendNotification(msg)) Print("NoiseArea: SendNotification fallo, error ", GetLastError());
  }

//+------------------------------------------------------------------+
//| Impresion de verificacion (una vez por dia)                      |
//+------------------------------------------------------------------+
void PrintVerification()
  {
   if(!InpVerboseLog || g_todayK < 0 || g_printedDate == g_todayDate) return;
   g_printedDate = g_todayDate;
   Session S = g_sess[g_todayK];
   Print("=== NoiseArea verificacion ", _Symbol, " dia NY ", TimeToString(S.nyDate, TIME_DATE), " ===");
   Print(StringFormat("O = %s (apertura vela %s NY)  PrevClose = %s  sesiones en historial = %d",
                      P(S.open), MinToHHMM(g_startMin + S.firstSlot), S.prevValid ? P(S.prevClose) : "n/d", g_nSess));
   int mins[4] = {600, 630, 720, 930};   // 10:00, 10:30, 12:00, 15:30
   for(int i = 0; i < 4; i++)
     {
      int s = SlotClosingAt(mins[i]);
      if(s < 0 || s >= g_slots) continue;
      string line = StringFormat("T=%s  sigma=%.6f (%d ses.)", MinToHHMM(mins[i]), S.sigma[s], S.sigmaN[s]);
      if(S.ub[s] != EMPTY_VALUE) line += StringFormat("  UB=%s  LB=%s", P(S.ub[s]), P(S.lb[s]));
      else line += "  UB/LB=n/d";
      if(s <= S.lastCompletedSlot && S.avail[s]) line += StringFormat("  C_T=%s  VWAP=%s", P(S.close[s]), P(S.vwap[s]));
      else line += "  C_T/VWAP=pendiente";
      Print(line);
     }
   // componentes de la sigma de las 10:30 para recalcularla a mano
   int s1030 = SlotClosingAt(630);
   if(s1030 >= 0 && s1030 < g_slots)
     {
      Print("Componentes sigma 10:30 = promedio de |C_T/O - 1| en las sesiones anteriores:");
      for(int j = g_todayK - 1; j >= 0 && j >= g_todayK - InpLookbackDays; j--)
        {
         if(!g_sess[j].avail[s1030] || g_sess[j].open <= 0.0)
           {
            Print(StringFormat("  %s  sin minuto 10:30 (excluida)", TimeToString(g_sess[j].nyDate, TIME_DATE)));
            continue;
           }
         Print(StringFormat("  %s  O=%s  C_10:30=%s  |C/O-1|=%.6f", TimeToString(g_sess[j].nyDate, TIME_DATE),
                            P(g_sess[j].open), P(g_sess[j].close[s1030]), MathAbs(g_sess[j].close[s1030] / g_sess[j].open - 1.0)));
        }
     }
  }

//+------------------------------------------------------------------+
//| Riesgo diario: realizado hoy (deals) + flotante, % del balance   |
//| inicial del dia. El dia es el del servidor (FTMO: CE(S)T).       |
//+------------------------------------------------------------------+
void DailyRisk(double &realized, double &floating, double &startBalance)
  {
   realized = 0.0;
   floating = 0.0;
   datetime now = TimeCurrent();
   datetime dayStart = DateOf(now);
   if(HistorySelect(dayStart, now + 60))
     {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
        {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0) continue;
         ENUM_DEAL_TYPE type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);
         if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;
         realized += HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_COMMISSION) + HistoryDealGetDouble(ticket, DEAL_SWAP);
        }
     }
   int np = PositionsTotal();
   for(int i = 0; i < np; i++)
     {
      string sym = PositionGetSymbol(i);
      if(sym == "") continue;
      floating += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
     }
   startBalance = AccountInfoDouble(ACCOUNT_BALANCE) - realized;
  }

//+------------------------------------------------------------------+
//| Posiciones reales abiertas en este simbolo                       |
//+------------------------------------------------------------------+
void RealPositions(double &longLots, double &shortLots)
  {
   longLots = 0.0;
   shortLots = 0.0;
   int np = PositionsTotal();
   for(int i = 0; i < np; i++)
     {
      string sym = PositionGetSymbol(i);
      if(sym != _Symbol) continue;
      long type = PositionGetInteger(POSITION_TYPE);
      double vol = PositionGetDouble(POSITION_VOLUME);
      if(type == POSITION_TYPE_BUY) longLots += vol; else shortLots += vol;
     }
  }

//+------------------------------------------------------------------+
//| Noticias: refresca la cache del calendario cada 60 s             |
//+------------------------------------------------------------------+
void RefreshNews()
  {
   if(!InpUseNewsCheck) return;
   datetime now = TimeCurrent();
   if(g_newsRefreshed != 0 && (long)now - (long)g_newsRefreshed < 60) return;
   g_newsRefreshed = now;
   if(MQLInfoInteger(MQL_TESTER) != 0) { g_newsAvailable = false; return; }
   MqlCalendarValue vals[];
   ResetLastError();
   int n = CalendarValueHistory(vals, (datetime)((long)now - 86400), (datetime)((long)now + 86400), NULL, InpNewsCurrency);
   if(n < 0 || (n == 0 && GetLastError() != 0)) { g_newsAvailable = false; return; }
   g_newsAvailable = true;
   ArrayResize(g_newsTime, 0);
   ArrayResize(g_newsName, 0);
   for(int i = 0; i < n; i++)
     {
      MqlCalendarEvent ev;
      if(!CalendarEventById(vals[i].event_id, ev)) continue;
      if(ev.importance != CALENDAR_IMPORTANCE_HIGH) continue;
      int sz = ArraySize(g_newsTime);
      ArrayResize(g_newsTime, sz + 1);
      ArrayResize(g_newsName, sz + 1);
      g_newsTime[sz] = vals[i].time;
      g_newsName[sz] = ev.name;
     }
  }

//+------------------------------------------------------------------+
//| Panel                                                            |
//+------------------------------------------------------------------+
int CharW() { return IMax(5, (int)MathRound(InpPanelFontSize * 0.78)); }
int RowH()  { return IMax(10, (int)MathRound(InpPanelFontSize * 1.9)); }

bool CreateLabel(const string name, const int x, const int y, const int fontSize, const color clr)
  {
   if(!ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0)) return false;
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, name, OBJPROP_FONT, PANEL_FONT);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, 10);
   ObjectSetString(0, name, OBJPROP_TEXT, " ");
   return true;
  }

bool CreatePanel()
  {
   int cw = CharW(), rh = RowH();
   int width  = cw * 96 + 16;
   int height = rh * 11 + rh * 2 + 20;
   string bg = PFX + "BG";
   if(!ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0)) return false;
   ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, InpPanelX);
   ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, InpPanelY);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, width);
   ObjectSetInteger(0, bg, OBJPROP_YSIZE, height);
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, InpPanelBg);
   ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, InpPanelBorder);
   ObjectSetInteger(0, bg, OBJPROP_BACK, false);
   ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, bg, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, bg, OBJPROP_ZORDER, 0);

   int x = InpPanelX + 8;
   int y = InpPanelY + 6;
   // filas 0..2: titulo, relojes, historial
   if(!CreateLabel(PFX + "R0", x, y, InpPanelFontSize + 1, InpPanelText)) return false;
   if(!CreateLabel(PFX + "R1", x, y + rh, InpPanelFontSize, InpPanelValues)) return false;
   if(!CreateLabel(PFX + "R2", x, y + 2 * rh, InpPanelFontSize, InpPanelValues)) return false;
   // filas 3..8: checks (nombre, estado, valores)
   for(int i = 0; i < 6; i++)
     {
      int yy = y + (3 + i) * rh;
      if(!CreateLabel(StringFormat("%sC%dN", PFX, i), x, yy, InpPanelFontSize, InpPanelText)) return false;
      if(!CreateLabel(StringFormat("%sC%dS", PFX, i), x + cw * 24, yy, InpPanelFontSize, clrGray)) return false;
      if(!CreateLabel(StringFormat("%sC%dV", PFX, i), x + cw * 29, yy, InpPanelFontSize, InpPanelValues)) return false;
     }
   // fila 9: estado general grande; fila 10: avisos
   if(!CreateLabel(PFX + "STATE", x, y + 9 * rh + 4, InpPanelFontSize + 6, clrGray)) return false;
   if(!CreateLabel(PFX + "WARN", x, y + 11 * rh + 8, InpPanelFontSize, clrOrange)) return false;
   return true;
  }

void SetText(const string name, const string text, const color clr)
  {
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
  }

void SetCheck(const int i, const string name, const int status, const string values)
  {
   // status: 1 = OK, 0 = NO, -1 = no aplica
   SetText(StringFormat("%sC%dN", PFX, i), name, InpPanelText);
   if(status > 0)       SetText(StringFormat("%sC%dS", PFX, i), "OK", clrLime);
   else if(status == 0) SetText(StringFormat("%sC%dS", PFX, i), "NO", clrRed);
   else                 SetText(StringFormat("%sC%dS", PFX, i), "--", clrGray);
   SetText(StringFormat("%sC%dV", PFX, i), values, InpPanelValues);
  }

string FmtCountdown(const long secs)
  {
   if(secs < 0) return "--:--";
   if(secs >= 3600) return StringFormat("%d:%02d:%02d", (int)(secs / 3600), (int)((secs % 3600) / 60), (int)(secs % 60));
   return StringFormat("%02d:%02d", (int)(secs / 60), (int)(secs % 60));
  }

//+------------------------------------------------------------------+
//| Proximo chequeo (hora NY) a partir de nowNY                      |
//+------------------------------------------------------------------+
datetime NextCheckNY(const datetime nowNY)
  {
   datetime d = DateOf(nowNY);
   for(int day = 0; day < 10; day++)
     {
      datetime dd = (datetime)((long)d + (long)day * 86400);
      if(!IsWeekday(dd)) continue;
      for(int m = g_firstCheckMin; m <= g_lastCheckMin; m += InpCheckEveryMin)
        {
         datetime t = (datetime)((long)dd + (long)m * 60);
         if(t > nowNY) return t;
        }
     }
   return 0;
  }

//+------------------------------------------------------------------+
//| Actualiza todo el panel                                          |
//+------------------------------------------------------------------+
void UpdatePanel()
  {
   datetime now   = TimeCurrent();
   datetime nowNY = ToNY(now);
   int nyMin      = MinuteOfDay(nowNY);
   bool weekday   = IsWeekday(nowNY);
   bool inSession = weekday && nyMin >= g_startMin && nyMin < g_endMin;

   // fila 0..2
   SetText(PFX + "R0", StringFormat("NOISE AREA  %s  %s   (Zarattini/Aziz/Barbon 2024)", _Symbol, EnumToString(_Period)), InpPanelText);
   SetText(PFX + "R1", StringFormat("Servidor %s  |  NY %s (offset %+d h)  |  Sesion %s",
                                  TimeToString(now, TIME_DATE | TIME_SECONDS), TimeToString(nowNY, TIME_DATE | TIME_SECONDS),
                                  -InpServerToNYHours, inSession ? "ABIERTA" : "CERRADA"), InpPanelValues);

   bool haveToday = (g_ready && g_todayK >= 0 && g_todayK < g_nSess && g_sess[g_todayK].computed && g_sess[g_todayK].firstSlot >= 0);
   string r2 = g_histStatus;
   if(haveToday)
      r2 += StringFormat("  |  O=%s  PrevClose=%s", P(g_sess[g_todayK].open), g_sess[g_todayK].prevValid ? P(g_sess[g_todayK].prevClose) : "n/d");
   SetText(PFX + "R2", r2, g_ready ? InpPanelValues : clrOrange);

   // valores en vivo del minuto actual
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ub = EMPTY_VALUE, lb = EMPTY_VALUE, vwap = EMPTY_VALUE;
   int simPos = 0;
   double simStop = EMPTY_VALUE;
   int sigmaN = 0;
   if(haveToday)
     {
      int slot = IMin(nyMin - g_startMin, g_sess[g_todayK].lastSlot);
      if(slot >= g_sess[g_todayK].firstSlot && slot < g_slots && slot >= 0 && g_sess[g_todayK].avail[slot])
        {
         ub     = g_sess[g_todayK].ub[slot];
         lb     = g_sess[g_todayK].lb[slot];
         vwap   = g_sess[g_todayK].vwap[slot];
         sigmaN = g_sess[g_todayK].sigmaN[slot];
         if(price <= 0.0) price = g_sess[g_todayK].close[g_sess[g_todayK].lastSlot];
        }
      simPos  = g_sess[g_todayK].pos[g_sess[g_todayK].lastSlot];
      simStop = g_sess[g_todayK].stop[g_sess[g_todayK].lastSlot];
     }
   bool bandsOk = (ub != EMPTY_VALUE && lb != EMPTY_VALUE && price > 0.0);

   // candidato: hacia donde esta el precio fuera del area
   int cand = 0;
   if(bandsOk && price > ub) cand = 1;
   else if(bandsOk && price < lb) cand = -1;

   // 1. hora valida
   bool isCheckMin = weekday && nyMin >= g_firstCheckMin && nyMin <= g_lastCheckMin && ((nyMin - g_firstCheckMin) % InpCheckEveryMin == 0);
   datetime next = NextCheckNY(nowNY);
   long secsLeft = (next > 0) ? (long)next - (long)nowNY : -1;
   string nextTxt = (next > 0) ? StringFormat("proximo %s NY en %s", TimeToString(next, TIME_MINUTES), FmtCountdown(secsLeft)) : "sin proximo chequeo";
   if(haveToday && g_sess[g_todayK].lastCheckSlot >= 0)
      nextTxt += StringFormat("  |  ultimo evaluado %s", MinToHHMM(CloseMinOfSlot(g_sess[g_todayK].lastCheckSlot)));
   SetCheck(0, "1 Hora valida (:00/:30)", isCheckMin ? 1 : 0, nextTxt);

   // 2. precio fuera del area
   if(bandsOk)
     {
      double dUB = (price - ub) / _Point;
      double dLB = (price - lb) / _Point;
      SetCheck(1, "2 Precio fuera del area", (cand != 0) ? 1 : 0,
               StringFormat("P=%s  UB=%s (%+.0f pts)  LB=%s (%+.0f pts)  sigma %d ses.", P(price), P(ub), dUB, P(lb), dLB, sigmaN));
     }
   else SetCheck(1, "2 Precio fuera del area", -1, haveToday ? "sin bandas para este minuto" : "sin sesion de hoy");

   // 3. lado del VWAP
   if(bandsOk && vwap != EMPTY_VALUE)
     {
      int st = -1;
      if(cand > 0) st = (price > vwap) ? 1 : 0;
      else if(cand < 0) st = (price < vwap) ? 1 : 0;
      SetCheck(2, "3 Lado correcto del VWAP", st, StringFormat("P=%s  VWAP=%s (%+.0f pts)%s", P(price), P(vwap), (price - vwap) / _Point,
               (cand == 0) ? "  (precio dentro del area)" : ""));
     }
   else SetCheck(2, "3 Lado correcto del VWAP", -1, "sin VWAP");

   // 4. sin posicion en esa direccion
   double realL = 0.0, realS = 0.0;
   RealPositions(realL, realS);
   string simTxt = (simPos > 0) ? "LARGO" : (simPos < 0) ? "CORTO" : "ninguna";
   int st4 = -1;
   if(cand > 0) st4 = (simPos > 0 || realL > 0.0) ? 0 : 1;
   else if(cand < 0) st4 = (simPos < 0 || realS > 0.0) ? 0 : 1;
   SetCheck(3, "4 Sin posicion en esa direccion", st4,
            StringFormat("simulada: %s  |  reales %s: L %.2f / S %.2f lotes", simTxt, _Symbol, realL, realS));

   // 5. margen de riesgo del dia
   double realized = 0.0, floating = 0.0, startBal = 0.0;
   DailyRisk(realized, floating, startBal);
   if(InpMaxDailyLossPct > 0.0 && startBal > 0.0)
     {
      double pct = (realized + floating) / startBal * 100.0;
      SetCheck(4, "5 Margen de riesgo del dia", (pct <= -InpMaxDailyLossPct) ? 0 : 1,
               StringFormat("%+.2f%% (realizado %+.2f / flotante %+.2f de %.2f)  limite -%.2f%%", pct, realized, floating, startBal, InpMaxDailyLossPct));
     }
   else SetCheck(4, "5 Margen de riesgo del dia", -1, (InpMaxDailyLossPct > 0.0) ? "sin balance" : "desactivado");

   // 6. noticias (solo aviso)
   if(InpUseNewsCheck)
     {
      RefreshNews();
      if(!g_newsAvailable) SetCheck(5, "6 Noticias alto impacto", -1, (MQLInfoInteger(MQL_TESTER) != 0) ? "sin datos (Probador)" : "sin datos (calendario no disponible)");
      else
        {
         int hit = -1;
         int nextIdx = -1;
         long bestDiff = 0;
         for(int i = 0; i < ArraySize(g_newsTime); i++)
           {
            long diff = (long)g_newsTime[i] - (long)now;
            long adiff = (diff < 0) ? -diff : diff;
            if(adiff <= (long)InpNewsWindowMin * 60) { hit = i; break; }
            if(diff > 0 && (nextIdx < 0 || diff < bestDiff)) { nextIdx = i; bestDiff = diff; }
           }
         if(hit >= 0)
            SetCheck(5, "6 Noticias alto impacto", 0, StringFormat("AVISO: %s a las %s NY (+-%d min)", g_newsName[hit],
                     TimeToString(ToNY(g_newsTime[hit]), TIME_MINUTES), InpNewsWindowMin));
         else if(nextIdx >= 0)
            SetCheck(5, "6 Noticias alto impacto", 1, StringFormat("sin eventos +-%d min  |  proxima %s: %s NY", InpNewsWindowMin,
                     g_newsName[nextIdx], TimeToString(ToNY(g_newsTime[nextIdx]), TIME_MINUTES)));
         else
            SetCheck(5, "6 Noticias alto impacto", 1, StringFormat("sin eventos %s de alto impacto en 24 h", InpNewsCurrency));
        }
     }
   else SetCheck(5, "6 Noticias alto impacto", -1, "desactivado");

   // estado general
   string state = "FUERA DE HORARIO";
   color  sc    = clrGray;
   if(!g_ready) { state = "CARGANDO HISTORIAL..."; sc = clrOrange; }
   else if(inSession && haveToday)
     {
      Session S = g_sess[g_todayK];
      int s = S.lastCheckSlot;
      bool flatDone = (g_flatSlot >= 0 && g_flatSlot < g_slots && g_flatSlot <= S.lastCompletedSlot && S.sig[g_flatSlot] == SIG_EXIT);
      if(flatDone) { state = "SALIR (cierre " + InpFlatTime + ")"; sc = clrGold; }
      else if(s < 0) { state = "SIN SENAL (esperando " + InpFirstCheck + ")"; sc = clrGray; }
      else
        {
         int sig = S.lastCheckSig;
         if(sig == SIG_BUY)       { state = StringFormat("SENAL DE COMPRA  (%s)  stop %s", MinToHHMM(CloseMinOfSlot(s)), (simStop != EMPTY_VALUE) ? P(simStop) : "n/d"); sc = clrLime; }
         else if(sig == SIG_SELL) { state = StringFormat("SENAL DE VENTA  (%s)  stop %s", MinToHHMM(CloseMinOfSlot(s)), (simStop != EMPTY_VALUE) ? P(simStop) : "n/d"); sc = clrRed; }
         else if(sig == SIG_EXIT) { state = StringFormat("SALIR  (%s)", MinToHHMM(CloseMinOfSlot(s))); sc = clrGold; }
         else if(simPos > 0)      { state = StringFormat("MANTENER LARGO  stop %s", (simStop != EMPTY_VALUE) ? P(simStop) : "n/d"); sc = clrLimeGreen; }
         else if(simPos < 0)      { state = StringFormat("MANTENER CORTO  stop %s", (simStop != EMPTY_VALUE) ? P(simStop) : "n/d"); sc = clrOrangeRed; }
         else                     { state = StringFormat("SIN SENAL  (%s)", MinToHHMM(CloseMinOfSlot(s))); sc = clrGray; }
        }
     }
   else if(inSession && !haveToday) { state = "SIN SENAL (sin datos de hoy)"; sc = clrGray; }
   SetText(PFX + "STATE", state, sc);

   // avisos
   string warn = "";
   if(PeriodSeconds() > PeriodSeconds(PERIOD_M30)) warn = "AVISO: usa M1 a M30. En H1 o mayor el dibujo es parcial.";
   else if(g_ready && g_nSess < InpLookbackDays + 1) warn = StringFormat("AVISO: solo %d sesiones M1; la sigma usa menos de %d sesiones.", g_nSess, InpLookbackDays);
   else if(!weekday) warn = "Fin de semana: sin sesion.";
   SetText(PFX + "WARN", warn, clrOrange);

   ChartRedraw();
  }
//+------------------------------------------------------------------+
