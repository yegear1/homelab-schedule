from __future__ import annotations

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from homelab_schedule.store import APP_TZ
from schemas.job import JobKind

_UNIT_MULTIPLIERS: dict[str, int] = {
    "s": 1,
    "sec": 1,
    "secs": 1,
    "seg": 1,
    "segs": 1,
    "segundo": 1,
    "segundos": 1,
    "second": 1,
    "seconds": 1,
    "m": 60,
    "min": 60,
    "mins": 60,
    "minuto": 60,
    "minutos": 60,
    "minute": 60,
    "minutes": 60,
    "h": 3600,
    "hr": 3600,
    "hrs": 3600,
    "hora": 3600,
    "horas": 3600,
    "hour": 3600,
    "hours": 3600,
    "d": 86400,
    "dia": 86400,
    "dias": 86400,
    "day": 86400,
    "days": 86400,
    "w": 7 * 86400,
    "sem": 7 * 86400,
    "semana": 7 * 86400,
    "semanas": 7 * 86400,
    "week": 7 * 86400,
    "weeks": 7 * 86400,
}

_WEEKDAYS: dict[str, int] = {
    "segunda": 0,
    "segunda-feira": 0,
    "seg": 0,
    "monday": 0,
    "mon": 0,
    "terça": 1,
    "terca": 1,
    "terça-feira": 1,
    "terca-feira": 1,
    "ter": 1,
    "tuesday": 1,
    "tue": 1,
    "quarta": 2,
    "quarta-feira": 2,
    "qua": 2,
    "wednesday": 2,
    "wed": 2,
    "quinta": 3,
    "quinta-feira": 3,
    "qui": 3,
    "thursday": 3,
    "thu": 3,
    "sexta": 4,
    "sexta-feira": 4,
    "sex": 4,
    "friday": 4,
    "fri": 4,
    "sábado": 5,
    "sabado": 5,
    "sab": 5,
    "saturday": 5,
    "sat": 5,
    "domingo": 6,
    "dom": 6,
    "sunday": 6,
    "sun": 6,
}


def parse_when(
    when: str,
    now: datetime | None = None,
    tz: ZoneInfo = APP_TZ,
) -> tuple[JobKind, datetime | None, str | None]:
    stripped = when.strip()
    if not stripped:
        raise ValueError("Expressão 'when' não pode ser vazia.")

    # 1. Cron (5 campos numéricos / padrão cron)
    cron_expr = _try_parse_cron(stripped)
    if cron_expr is not None:
        return JobKind.CRON, None, cron_expr

    # 2. ISO-8601 (ex: 2026-09-12T14:00:00-03:00, 2026-09-12 14:00:00)
    iso_dt = _try_parse_iso(stripped, tz)
    if iso_dt is not None:
        return JobKind.ONCE, iso_dt, None

    # Momento de referência no fuso alvo
    ref_now = (now if now is not None else datetime.now(tz)).astimezone(tz)

    # 3. Intervalo relativo (+15m, 2h, em 10 minutos, daqui a 1 hora e 30 minutos)
    rel_dt = _try_parse_relative(stripped, ref_now)
    if rel_dt is not None:
        return JobKind.ONCE, rel_dt, None

    # 4. Data e horário amigáveis (amanhã 14h, hoje 18:00, segunda 9h, 14:00)
    friendly_dt = _try_parse_friendly_calendar(stripped, ref_now, tz)
    if friendly_dt is not None:
        return JobKind.ONCE, friendly_dt, None

    raise ValueError(
        f"Não foi possível interpretar 'when': '{when}'. "
        "Use formato ISO-8601, cron de 5 campos (ex: '0 9 * * 1'), "
        "intervalo relativo (ex: '+15m', '2h', 'em 2 horas') ou "
        "dia/horário amigável (ex: 'amanhã 14h', 'hoje 18:00', 'segunda 9h')."
    )


def default_title(content: str) -> str:
    line = content.strip().splitlines()[0] if content.strip() else "lembrete"
    return line[:120]


def parse_period(
    period: str,
    now: datetime | None = None,
    tz: ZoneInfo = APP_TZ,
) -> tuple[datetime, datetime]:
    stripped = period.strip()
    if not stripped:
        raise ValueError("Expressão de período não pode ser vazia.")

    ref_now = (now if now is not None else datetime.now(tz)).astimezone(tz)
    norm = stripped.lower().strip()

    # 1. Âncoras do dia
    if norm in ("hoje", "today"):
        d = ref_now.date()
        return (
            datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=tz),
            datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=tz),
        )
    if norm in ("amanhã", "amanha", "tomorrow"):
        tom = ref_now.date() + timedelta(days=1)
        return (
            datetime(tom.year, tom.month, tom.day, 0, 0, 0, tzinfo=tz),
            datetime(tom.year, tom.month, tom.day, 23, 59, 59, 999999, tzinfo=tz),
        )
    if norm in ("depois de amanhã", "depois de amanha"):
        dda = ref_now.date() + timedelta(days=2)
        return (
            datetime(dda.year, dda.month, dda.day, 0, 0, 0, tzinfo=tz),
            datetime(dda.year, dda.month, dda.day, 23, 59, 59, 999999, tzinfo=tz),
        )
    if norm in ("ontem", "yesterday"):
        yest = ref_now.date() - timedelta(days=1)
        return (
            datetime(yest.year, yest.month, yest.day, 0, 0, 0, tzinfo=tz),
            datetime(yest.year, yest.month, yest.day, 23, 59, 59, 999999, tzinfo=tz),
        )

    # 2. Âncoras de semana
    if norm in ("esta semana", "essa semana", "this week"):
        mon = ref_now.date() - timedelta(days=ref_now.weekday())
        sun = mon + timedelta(days=6)
        return (
            datetime(mon.year, mon.month, mon.day, 0, 0, 0, tzinfo=tz),
            datetime(sun.year, sun.month, sun.day, 23, 59, 59, 999999, tzinfo=tz),
        )
    if norm in ("próxima semana", "proxima semana", "next week"):
        next_mon = ref_now.date() - timedelta(days=ref_now.weekday()) + timedelta(days=7)
        next_sun = next_mon + timedelta(days=6)
        return (
            datetime(next_mon.year, next_mon.month, next_mon.day, 0, 0, 0, tzinfo=tz),
            datetime(next_sun.year, next_sun.month, next_sun.day, 23, 59, 59, 999999, tzinfo=tz),
        )
    if norm in ("semana passada", "last week"):
        past_mon = ref_now.date() - timedelta(days=ref_now.weekday()) - timedelta(days=7)
        past_sun = past_mon + timedelta(days=6)
        return (
            datetime(past_mon.year, past_mon.month, past_mon.day, 0, 0, 0, tzinfo=tz),
            datetime(past_sun.year, past_sun.month, past_sun.day, 23, 59, 59, 999999, tzinfo=tz),
        )

    # 3. Âncoras de mês
    if norm in ("este mês", "este mes", "this month"):
        start = datetime(ref_now.year, ref_now.month, 1, 0, 0, 0, tzinfo=tz)
        next_y = ref_now.year if ref_now.month < 12 else ref_now.year + 1
        next_m = ref_now.month + 1 if ref_now.month < 12 else 1
        end = datetime(next_y, next_m, 1, 0, 0, 0, tzinfo=tz) - timedelta(microseconds=1)
        return (start, end)
    if norm in ("próximo mês", "proximo mes", "next month"):
        start_y = ref_now.year if ref_now.month < 12 else ref_now.year + 1
        start_m = ref_now.month + 1 if ref_now.month < 12 else 1
        start = datetime(start_y, start_m, 1, 0, 0, 0, tzinfo=tz)
        next_y = start_y if start_m < 12 else start_y + 1
        next_m = start_m + 1 if start_m < 12 else 1
        end = datetime(next_y, next_m, 1, 0, 0, 0, tzinfo=tz) - timedelta(microseconds=1)
        return (start, end)
    if norm in ("mês passado", "mes passado", "last month"):
        prev_y = ref_now.year if ref_now.month > 1 else ref_now.year - 1
        prev_m = ref_now.month - 1 if ref_now.month > 1 else 12
        start = datetime(prev_y, prev_m, 1, 0, 0, 0, tzinfo=tz)
        month_start = datetime(ref_now.year, ref_now.month, 1, 0, 0, 0, tzinfo=tz)
        end = month_start - timedelta(microseconds=1)
        return (start, end)

    # 4. Dias da semana (ex: "segunda", "próxima sexta", "terça-feira")
    clean_wd = re.sub(r"^(?:na|no|em|próxima|proxima|next)\s+", "", norm).strip()
    if clean_wd in _WEEKDAYS:
        target_wd = _WEEKDAYS[clean_wd]
        diff = (target_wd - ref_now.weekday()) % 7
        target_date = ref_now.date() + timedelta(days=diff)
        return (
            datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=tz),
            datetime(
                target_date.year, target_date.month, target_date.day, 23, 59, 59, 999999, tzinfo=tz
            ),
        )

    # 5. Formatos ISO de data: YYYY-MM-DD ou YYYY-MM
    iso_date_match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", norm)
    if iso_date_match:
        iso_year = int(iso_date_match.group(1))
        iso_month = int(iso_date_match.group(2))
        iso_day = int(iso_date_match.group(3))
        try:
            return (
                datetime(iso_year, iso_month, iso_day, 0, 0, 0, tzinfo=tz),
                datetime(iso_year, iso_month, iso_day, 23, 59, 59, 999999, tzinfo=tz),
            )
        except ValueError as exc:
            raise ValueError(f"Data ISO inválida: '{period}'.") from exc

    iso_month_match = re.fullmatch(r"(\d{4})-(\d{2})", norm)
    if iso_month_match:
        y, m = int(iso_month_match.group(1)), int(iso_month_match.group(2))
        try:
            start = datetime(y, m, 1, 0, 0, 0, tzinfo=tz)
            next_y = y if m < 12 else y + 1
            next_m = m + 1 if m < 12 else 1
            end = datetime(next_y, next_m, 1, 0, 0, 0, tzinfo=tz) - timedelta(microseconds=1)
            return (start, end)
        except ValueError as exc:
            raise ValueError(f"Mês ISO inválido: '{period}'.") from exc

    # 6. Duração relativa passada ou futura
    is_past = False
    dur_text = norm
    past_prefix_pattern = r"^(?:últimos|ultimos|últimas|ultimas|past|last)\s+"
    if dur_text.startswith("-"):
        dur_text = dur_text[1:].strip()
        is_past = True
    elif re.match(past_prefix_pattern, dur_text):
        dur_text = re.sub(past_prefix_pattern, "", dur_text).strip()
        is_past = True
    elif dur_text.startswith("+"):
        dur_text = dur_text[1:].strip()
    elif re.match(r"^(?:próximos|proximos|próximas|proximas|next)\s+", dur_text):
        dur_text = re.sub(r"^(?:próximos|proximos|próximas|proximas|next)\s+", "", dur_text).strip()

    matches = list(re.finditer(r"(\d+(?:\.\d+)?)\s*([a-z]+)", dur_text))
    if matches:
        all_units_valid = all(m.group(2) in _UNIT_MULTIPLIERS for m in matches)
        remainder = re.sub(r"(\d+(?:\.\d+)?)\s*([a-z]+)", "", dur_text)
        remainder = re.sub(r"[\s,+]|(?:\b(?:e|and)\b)", "", remainder)
        if all_units_valid and not remainder:
            total_seconds = sum(float(m.group(1)) * _UNIT_MULTIPLIERS[m.group(2)] for m in matches)
            if total_seconds <= 0:
                raise ValueError("Intervalo deve ser maior que zero.")
            delta = timedelta(seconds=total_seconds)
            if is_past:
                return (ref_now - delta, ref_now)
            return (ref_now, ref_now + delta)

    raise ValueError(
        f"Não foi possível interpretar o período: '{period}'. "
        "Use expressões como 'hoje', 'amanhã', 'esta semana', 'próxima semana', 'este mês', "
        "'7d', 'próximos 7 dias', 'últimos 7 dias', ou data 'YYYY-MM-DD'."
    )


def _try_parse_cron(stripped: str) -> str | None:
    fields = stripped.split()
    if len(fields) != 5:
        return None
    ranges = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 7)]
    for field, (lo, hi) in zip(fields, ranges, strict=True):
        if not _is_valid_cron_field(field, lo, hi):
            return None
    return stripped


def _is_valid_cron_field(field: str, lo: int, hi: int) -> bool:
    for part in field.split(","):
        if part == "*":
            continue
        if "/" in part:
            subparts = part.split("/")
            if len(subparts) != 2:
                return False
            base, step_s = subparts
            if not step_s.isdigit() or int(step_s) <= 0:
                return False
            if base != "*":
                if "-" in base:
                    sub_range = base.split("-", 1)
                    if len(sub_range) != 2:
                        return False
                    s, e = sub_range
                    if not (s.isdigit() and e.isdigit() and lo <= int(s) <= int(e) <= hi):
                        return False
                elif not (base.isdigit() and lo <= int(base) <= hi):
                    return False
        elif "-" in part:
            subparts = part.split("-")
            if len(subparts) != 2:
                return False
            s, e = subparts
            if not (s.isdigit() and e.isdigit() and lo <= int(s) <= int(e) <= hi):
                return False
        elif part.isdigit():
            if not (lo <= int(part) <= hi):
                return False
        else:
            return False
    return True


def _try_parse_iso(stripped: str, tz: ZoneInfo) -> datetime | None:
    if not re.match(r"^\d{4}-\d{2}-\d{2}", stripped):
        return None
    try:
        dt = datetime.fromisoformat(stripped.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=tz)
        return dt
    except ValueError:
        return None


def _try_parse_relative(stripped: str, now: datetime) -> datetime | None:
    norm = stripped.lower().strip()
    has_prefix = False

    if norm.startswith("+"):
        norm = norm[1:].strip()
        has_prefix = True
    elif norm.startswith("daqui a "):
        norm = norm[8:].strip()
        has_prefix = True
    elif norm.startswith("daqui "):
        norm = norm[6:].strip()
        has_prefix = True
    elif norm.startswith("em "):
        norm = norm[3:].strip()
        has_prefix = True
    elif norm.startswith("in "):
        norm = norm[3:].strip()
        has_prefix = True
    elif norm.startswith("after "):
        norm = norm[6:].strip()
        has_prefix = True

    matches = list(re.finditer(r"(\d+(?:\.\d+)?)\s*([a-z]+)", norm))
    if not matches:
        return None

    # Verificar se todas as unidades são conhecidas
    for m in matches:
        if m.group(2) not in _UNIT_MULTIPLIERS:
            return None

    # Verificar caracteres restantes
    remainder = re.sub(r"(\d+(?:\.\d+)?)\s*([a-z]+)", "", norm)
    remainder = re.sub(r"[\s,+]|(?:\b(?:e|and)\b)", "", remainder)
    if remainder:
        return None

    # Se não tiver prefixo explícito e for apenas uma indicação de hora > 12 (ex: "14h", "18h"),
    # trata-se de horário de relógio (14:00, 18:00), que deve ser tratado pelo calendário amigável
    if not has_prefix and len(matches) == 1:
        val = float(matches[0].group(1))
        unit = matches[0].group(2)
        if unit in ("h", "hr", "hrs", "hora", "horas", "hour", "hours") and val > 12:
            return None

    total_seconds = 0.0
    for m in matches:
        val = float(m.group(1))
        unit = m.group(2)
        total_seconds += val * _UNIT_MULTIPLIERS[unit]

    if total_seconds <= 0:
        raise ValueError("Intervalo relativo deve ser maior que zero.")

    return now + timedelta(seconds=total_seconds)


def _try_parse_friendly_calendar(
    stripped: str,
    now: datetime,
    tz: ZoneInfo,
) -> datetime | None:
    norm = stripped.lower().strip()

    # Tentar extrair hora:
    # Formato 1: HH:MM ou HH:MM:SS
    # Formato 2: HHh ou HHhMM ou HHhMMm
    # Formato 3: HH horas
    time_match = re.search(r"\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b", norm)
    hour: int
    minute: int
    second: int
    span: tuple[int, int]

    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
        second = int(time_match.group(3)) if time_match.group(3) else 0
        span = time_match.span()
    else:
        time_match_h = re.search(r"\b(\d{1,2})h(?:(\d{1,2})m?)?\b", norm)
        if time_match_h:
            hour = int(time_match_h.group(1))
            minute = int(time_match_h.group(2)) if time_match_h.group(2) else 0
            second = 0
            span = time_match_h.span()
        else:
            time_match_horas = re.search(r"\b(\d{1,2})\s*(?:horas|hora)\b", norm)
            if time_match_horas:
                hour = int(time_match_horas.group(1))
                minute = 0
                second = 0
                span = time_match_horas.span()
            else:
                return None

    if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
        raise ValueError(f"Horário inválido: {hour:02d}:{minute:02d}:{second:02d}")

    # Remover o trecho de hora e conectores do texto
    remainder = norm[: span[0]] + " " + norm[span[1] :]
    remainder = re.sub(r"\b(?:às|as|at|@)\b", "", remainder).strip()

    target_date = now.date()

    if not remainder:
        # Apenas horário (ex: "14:00", "18h")
        candidate = datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            hour,
            minute,
            second,
            tzinfo=tz,
        )
        if candidate <= now:
            target_date += timedelta(days=1)
    elif remainder in ("hoje", "today"):
        pass
    elif remainder in ("amanhã", "amanha", "tomorrow"):
        target_date += timedelta(days=1)
    elif remainder in ("depois de amanhã", "depois de amanha"):
        target_date += timedelta(days=2)
    else:
        # Verificar dia da semana (prefixos: próxima, proxima, next, na, no, em)
        wd_clean = re.sub(r"^(?:próxima|proxima|next|na|no|em)\s+", "", remainder).strip()
        if wd_clean in _WEEKDAYS:
            target_wd = _WEEKDAYS[wd_clean]
            current_wd = now.weekday()
            diff = (target_wd - current_wd) % 7
            if diff == 0:
                candidate = datetime(
                    target_date.year,
                    target_date.month,
                    target_date.day,
                    hour,
                    minute,
                    second,
                    tzinfo=tz,
                )
                if candidate <= now:
                    diff = 7
            target_date += timedelta(days=diff)
        else:
            return None

    return datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        hour,
        minute,
        second,
        tzinfo=tz,
    )
