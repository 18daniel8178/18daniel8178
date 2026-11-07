#!/usr/bin/env python3
"""
Referencia independiente de NoiseArea.mq5 para verificar a mano la sigma, las bandas,
el VWAP y las senales de un dia a partir de un CSV de velas M1 exportado desde MT5
(Ver > Simbolos > Barras > Exportar; columnas separadas por tabulador, hora del servidor).

Uso:
  python3 noise_area_check.py --csv US500_M1.csv --date 2026-11-05 --offset 7
  python3 noise_area_check.py --csv US500_M1.csv --date 2026-11-05 --offset 7 --time 10:30

Los numeros que imprime deben coincidir con los Print del indicador para el mismo dia
(pestana Expertos de MT5), salvo diferencias de redondeo en el ultimo decimal.
"""
import argparse
import csv
from collections import OrderedDict
from datetime import datetime, timedelta


def hhmm(s):
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def load_bars(path):
    """Devuelve lista de (datetime servidor, open, high, low, close, tickvol)."""
    bars = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096)
        f.seek(0)
        delim = "\t" if sample.count("\t") >= sample.count(",") else ","
        reader = csv.reader(f, delimiter=delim)
        for row in reader:
            if not row or row[0].startswith("<") or row[0].lower().startswith("date"):
                continue
            if len(row) >= 7 and " " not in row[0]:
                dt = datetime.strptime(row[0] + " " + row[1], "%Y.%m.%d %H:%M:%S")
                o, h, l, c, tv = map(float, row[2:7])
            else:  # formato "YYYY.MM.DD HH:MM" en una sola columna
                dt = datetime.strptime(row[0][:16], "%Y.%m.%d %H:%M")
                o, h, l, c, tv = map(float, row[1:6])
            bars.append((dt, o, h, l, c, tv))
    bars.sort(key=lambda b: b[0])
    return bars


def build_sessions(bars, offset_h, start_min, end_min):
    """Agrupa las velas M1 por dia NY dentro de la sesion regular. Slot = minuto de apertura - inicio."""
    slots = end_min - start_min
    sessions = OrderedDict()
    for dt, o, h, l, c, tv in bars:
        ny = dt - timedelta(hours=offset_h)
        if ny.weekday() > 4:
            continue
        m = ny.hour * 60 + ny.minute
        slot = m - start_min
        if slot < 0 or slot >= slots:
            continue
        d = ny.date()
        S = sessions.get(d)
        if S is None:
            S = {"date": d, "open": o, "close": [None] * slots, "vwap": [None] * slots,
                 "first": slot, "last": -1, "pv": 0.0, "v": 0.0}
            sessions[d] = S
        # huecos: ultimo cierre disponible antes de T
        for s in range(S["last"] + 1, slot):
            if S["last"] >= 0:
                S["close"][s] = S["close"][S["last"]]
                S["vwap"][s] = S["vwap"][S["last"]]
        tp = (h + l + c) / 3.0
        S["pv"] += tp * tv
        S["v"] += tv
        S["close"][slot] = c
        S["vwap"][slot] = S["pv"] / S["v"] if S["v"] > 0 else tp
        S["last"] = slot
    return list(sessions.values()), slots


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="CSV M1 exportado desde MT5")
    ap.add_argument("--date", required=True, help="Dia NY a verificar, AAAA-MM-DD")
    ap.add_argument("--offset", type=int, default=7, help="Horas que el servidor va adelantado a NY")
    ap.add_argument("--lookback", type=int, default=14)
    ap.add_argument("--vm", type=float, default=1.0)
    ap.add_argument("--session", default="09:30-16:00")
    ap.add_argument("--checks", default="10:00-15:30")
    ap.add_argument("--every", type=int, default=30)
    ap.add_argument("--flat", default="15:58")
    ap.add_argument("--time", default="10:30", help="Hora NY cuya sigma se desglosa")
    ap.add_argument("--digits", type=int, default=2)
    a = ap.parse_args()

    start_min, end_min = (hhmm(x) for x in a.session.split("-"))
    first_chk, last_chk = (hhmm(x) for x in a.checks.split("-"))
    flat_min = hhmm(a.flat)
    target = datetime.strptime(a.date, "%Y-%m-%d").date()

    bars = load_bars(a.csv)
    sessions, slots = build_sessions(bars, a.offset, start_min, end_min)
    idx = next((i for i, S in enumerate(sessions) if S["date"] == target), None)
    if idx is None:
        raise SystemExit(f"No hay sesion para {target} en el CSV (sesiones: {sessions[0]['date']} .. {sessions[-1]['date']})")
    S = sessions[idx]
    prev = sessions[idx - 1] if idx > 0 else None
    prev_close = prev["close"][prev["last"]] if prev else None
    fmt = lambda v: "n/d" if v is None else f"{v:.{a.digits}f}"

    def slot_closing_at(m):
        return m - start_min - 1

    def sigma_at(s):
        vals = []
        for j in range(idx - 1, max(-1, idx - 1 - a.lookback), -1):
            P = sessions[j]
            if P["close"][s] is None or s < P["first"] or s > P["last"]:
                continue  # sesion sin ese minuto (cierre temprano) -> excluida
            vals.append((P["date"], P["open"], P["close"][s], abs(P["close"][s] / P["open"] - 1.0)))
        sig = sum(v[3] for v in vals) / len(vals) if vals else None
        return sig, vals

    def bands(s):
        sig, _ = sigma_at(s)
        if sig is None or prev_close is None:
            return None, None, sig
        ub = max(S["open"], prev_close) * (1 + a.vm * sig)
        lb = min(S["open"], prev_close) * (1 - a.vm * sig)
        return ub, lb, sig

    print(f"=== NoiseArea verificacion dia NY {target} (offset servidor-NY {a.offset} h) ===")
    print(f"O = {fmt(S['open'])} (apertura vela {(start_min + S['first']) // 60:02d}:{(start_min + S['first']) % 60:02d} NY)"
          f"  PrevClose = {fmt(prev_close)}  sesiones en CSV = {len(sessions)}")
    for m in (600, 630, 720, 930):
        s = slot_closing_at(m)
        ub, lb, sig = bands(s)
        c = S["close"][s] if 0 <= s < slots else None
        v = S["vwap"][s] if 0 <= s < slots else None
        print(f"T={m // 60:02d}:{m % 60:02d}  sigma={sig if sig is None else f'{sig:.6f}'}  UB={fmt(ub)}  LB={fmt(lb)}"
              f"  C_T={fmt(c)}  VWAP={fmt(v)}")

    s_t = slot_closing_at(hhmm(a.time))
    sig, comps = sigma_at(s_t)
    print(f"\nComponentes sigma {a.time} = promedio de |C_T/O - 1| en las {len(comps)} sesiones anteriores:")
    for d, o, c, r in comps:
        print(f"  {d}  O={fmt(o)}  C_{a.time}={fmt(c)}  |C/O-1|={r:.6f}")
    print(f"  sigma({a.time}) = {sig if sig is None else f'{sig:.6f}'}")

    print("\nSimulacion de la posicion (orden: salida, entrada, cierre a la hora flat):")
    pos = 0
    for m in list(range(first_chk, last_chk + 1, a.every)) + [flat_min]:
        s = slot_closing_at(m)
        if s < S["first"] or s > S["last"] or S["close"][s] is None:
            print(f"  {m // 60:02d}:{m % 60:02d}  sin datos")
            continue
        c, v = S["close"][s], S["vwap"][s]
        if m == flat_min:
            act = "SALIR (cierre)" if pos else "nada"
            pos = 0
            print(f"  {m // 60:02d}:{m % 60:02d}  C_T={fmt(c)}  -> {act}")
            continue
        ub, lb, sig = bands(s)
        if ub is None:
            print(f"  {m // 60:02d}:{m % 60:02d}  sin bandas")
            continue
        acts = []
        if pos > 0 and c < max(ub, v):
            pos = 0; acts.append("SALIR")
        elif pos < 0 and c > min(lb, v):
            pos = 0; acts.append("SALIR")
        if pos == 0:
            if c > ub and c > v:
                pos = 1; acts.append("COMPRA")
            elif c < lb and c < v:
                pos = -1; acts.append("VENTA")
        stop = max(ub, v) if pos > 0 else min(lb, v) if pos < 0 else None
        print(f"  {m // 60:02d}:{m % 60:02d}  C_T={fmt(c)} UB={fmt(ub)} LB={fmt(lb)} VWAP={fmt(v)} sigma={sig:.6f}"
              f"  -> {' + '.join(acts) if acts else 'nada'}  pos={pos}  stop={fmt(stop)}")


if __name__ == "__main__":
    main()
