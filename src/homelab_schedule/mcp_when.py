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
