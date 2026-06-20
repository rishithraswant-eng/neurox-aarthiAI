import pandas as pd

def apply_hard_gate(row: dict, universe_turnover_threshold: float = 500000) -> tuple[bool, list]:
    reasons = []
    
    avg_turnover = row.get('avg_turnover_30d')
    if pd.isna(avg_turnover) or avg_turnover is None:
        reasons.append("Insufficient data for hard gate evaluation (missing avg_turnover_30d)")
    elif avg_turnover < universe_turnover_threshold:
        reasons.append(f"Low liquidity: avg 30d turnover {avg_turnover:.0f} below threshold")

    debt_equity = row.get('debt_equity')
    if pd.isna(debt_equity) or debt_equity is None:
        reasons.append("Insufficient data for hard gate evaluation (missing debt_equity)")
    elif debt_equity > 2.0:
        reasons.append(f"High leverage: D/E {debt_equity:.2f} exceeds 2.0")

    return (len(reasons) == 0, reasons)
