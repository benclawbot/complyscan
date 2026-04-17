#!/usr/bin/env python3
"""Thomas Chaffanjet - PostFinance Dashboard Builder
Full year Apr 2025 - Mar 2026
"""

import re, os, json
import subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from datetime import datetime
from pathlib import Path

# ====== VERIFIED MONTHLY DATA ======
MONTH_ORDER = ["Apr 2025","May 2025","Jun 2025","Jul 2025","Aug 2025","Sep 2025",
                "Oct 2025","Nov 2025","Dec 2025","Jan 2026","Feb 2026","Mar 2026"]

MONTHLY = {
    "Apr 2025":  {"income": 21357.05, "expenses": 14032.24, "balance": 8964.02},
    "May 2025":  {"income": 20733.40, "expenses": 26331.26, "balance": 3366.16},
    "Jun 2025":  {"income": 15365.29, "expenses": 7555.75,  "balance": 11176.01},
    "Jul 2025":  {"income": 17896.67, "expenses": 21759.67, "balance": 7312.70},
    "Aug 2025":  {"income": 11690.99, "expenses": 11346.88, "balance": 7656.81},
    "Sep 2025":  {"income": 31399.50, "expenses": 27917.76, "balance": 11138.55},
    "Oct 2025":  {"income": 21447.45, "expenses": 29140.08, "balance": 3445.92},
    "Nov 2025":  {"income": 14016.53, "expenses": 8972.20,  "balance": 8490.25},
    "Dec 2025":  {"income": 17143.00, "expenses": 23255.17, "balance": 2378.08},
    "Jan 2026":  {"income": 13890.68, "expenses": 6027.91,  "balance": 10240.85},
    "Feb 2026":  {"income": 12896.45, "expenses": 13716.83, "balance": 9420.47},
    "Mar 2026":  {"income": 15746.97, "expenses": 16078.65, "balance": 9088.79},
}

STATEMENTS_DIR = Path(
    os.getenv(
        "POSTFINANCE_STATEMENTS_DIR",
        str(Path.home() / "Documents" / "postfinance-statements"),
    )
)


def _statement_file(name: str) -> str:
    return str(STATEMENTS_DIR / name)


PDFS = {
    "Apr 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025050104371092---94f94873-d7d8-47d1-a6d3-4d7498798f4d.pdf"),
    "May 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025060102552617---f4eb76e9-5d68-48b7-8f03-ea058ac61483.pdf"),
    "Jun 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025070104041121---a4500456-f10e-4456-b9d8-b3d64a275599.pdf"),
    "Jul 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025080104591559---740b5642-47dd-4242-bffb-cc56b0cf5984.pdf"),
    "Aug 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025090104071916---04e284a5-a4f7-49dd-8731-657e880da266.pdf"),
    "Sep 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025090104071916---f188ab19-d081-48d1-b4d5-eb8cddc593e6.pdf"),
    "Oct 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025100103502664---45186a93-c682-4e33-957c-6320d6561b7d.pdf"),
    "Nov 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0-2025110103321781---958c36b0-b637-4de4-88f6-de916aa45820.pdf"),
    "Dec 2025":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025120105161218---14ef6e67-77e5-4cce-a2bb-73a98d15f11d.pdf"),
    "Jan 2026":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2026010113212202---675ef013-fff2-4cef-9c3e-cb442ae6edc2.pdf"),
    "Feb 2026":  _statement_file("REP_P_CH1809000000127269836_1105749371_0_2026020105242707---d82e9b0a-9f0a-4c1f-8262-fbc9858fec7a.pdf"),
    "Mar 2026":  _statement_file("REP_P_CH1809000000127269836_1138321291_0_2026040111371289---11b592e2-bc68-4851-ad5d-ed9237b3f017.pdf"),
}

# Fix Nov filename (was missing underscore)
PDFS["Nov 2025"] = _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025110103321781---958c36b0-b637-4de4-88f6-de916aa45820.pdf")

def parse_pdf(path):
    r = subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, errors='replace')
    return r.stdout

def parse_transactions(text):
    """Parse all debit and credit lines from statement text."""
    lines = text.split('\n')
    txs = []
    
    # Regex patterns
    # Format: DÉBIT  amount  date OR CRÉDIT  amount  date
    # amount looks like: 1 234.56 or 1234.56 or 1'234.56
    amt_re = r"([\d' ]+[.,]\d{2})"
    
    for i, line in enumerate(lines):
        line_s = line.strip()
        if not line_s:
            continue
        
        # Detect type + amount + date
        m_credit = re.search(r"CRÉDIT\s+" + amt_re + r"\s+(\d{2}[./]\d{2}[./]\d{2,4})", line_s, re.IGNORECASE)
        m_debit = re.search(r"^DÉBIT\s+" + amt_re + r"\s+(\d{2}[./]\d{2}[./]\d{2,4})", line_s, re.IGNORECASE)
        
        # Try standalone debit (amount at start)
        if not m_debit:
            m_debit = re.search(r"^\s*" + amt_re + r"\s+\d{2}[./]\d{2}[./]\d{2,4}\s*$", line_s)
        
        tx = {}
        if m_credit:
            amt_str = m_credit.group(1).replace("'", "").replace(" ", "").replace(",", ".")
            tx = {"type": "credit", "amount": float(amt_str), "raw": line_s}
        elif m_debit:
            amt_str = m_debit.group(1).replace("'", "").replace(" ", "").replace(",", ".")
            tx = {"type": "debit", "amount": float(amt_str), "raw": line_s}
        
        if tx:
            # Get description from preceding context lines
            desc_lines = []
            for j in range(i-6, i):
                if j >= 0:
                    dl = lines[j].strip()
                    if dl and not re.match(r'^[\s\d\-/.]+$', dl):
                        dl_clean = re.sub(r'\s+', ' ', dl).strip()
                        if len(dl_clean) > 4 and len(dl_clean) < 120:
                            desc_lines.append(dl_clean)
            tx["description"] = " | ".join(desc_lines[-2:]) if desc_lines else ""
            txs.append(tx)
    
    return txs

# EXPENSE CATEGORIES
EXPENSE_CATS = {
    "Housing":       ["LOYER", "HELVESTRASSE", "RENT"],
    "Health Insurance": ["AVENIR ASSURANCE", "MUTUEL ASSURANCE", "GENERALIA", "3ÈME PILIER", "3ÈME PILLIER"],
    "Cantonal Tax":  ["IMPÔTS", "IMPOTS", "ETAT DE VAUD", "CANTON"],
    "Dental/Medical": ["DR. PONCIN", "DENTIST", "CAISSE POUR MÉDECINS", "TOMATIS"],
    "Groceries":     ["MIGROS", "COOP ", "DENNER", "LIDL", "MANOR AG", "CHICORÉE", "EPICIER", "MARCHANDISES"],
    "Restaurants":    ["RESTAURANT", "TAKE AWAY", "UBEREATS", "MCDONALD", "KEBAB", "GELATO", "CAFÉ", "CAFE", "BRASSERIE", "BISTROT", "POOLHOUSE", "BOULANGER", "FERNAND"],
    "Transport":     ["SBB ", "SBB M", "MIGROL", "GARAGE", "PARKING", "CARBURANT", "AMAG ", "CARTE N"],
    "Entertainment":  ["NETFLIX", "DISNEY", "XBOX", "AMAZON", "STEAM", "ALEXPRESS", "IKEA", "DECATHLON"],
    "Phone/Internet": ["SALT MOBILE", "SALT FIBER", "GOOGLE ONE"],
    "Kids":          ["TENNIS ENFANT", "ENGLISH", "TREASURE KIDS", "FUN WITH", "JACK CHAF", "NOAH CHAF"],
    "Clothing":      ["C&A", "ZARA", "H&M", "PRIMARK"],
    "Healthcare":     ["PHARMACIE", "DOCTOR", "MÉDECIN"],
    "Savings Out":   ["TRANSFERT.*EPARGNE", "EPARGNE MARS", "REMBoursement.*AVANCE", "REMB POUR AVANCE"],
    "Investments":   ["INVEST LIKE", "TRADEFURY", "FX", "FOREX"],
    "Tobacco":       ["SMOKE", "CIGAR", "BOUCHERIE"],
}

INCOME_CATS = {
    "Salary":        ["SALARY PAYMENT", "PRIME INTERNATIONAL"],
    "Family Allowances": ["ALLOCATIONS FAMILIALES", "FERRIA"],
    "AVS Refunds":   ["AVS 2ÈME TRIMESTRE", "AVS 3ÈME TRIMESTRE", "AVANCE POUR AVS"],
    "Insurance Refunds": ["REMBOURSEMENT", "REIMBURSEMENT", "DECOMPTE AVENIR", "AIDE ET SOUTIEN"],
}

def categorize_tx(tx):
    desc = tx.get("description", "").upper() + " " + tx.get("raw", "").upper()
    if tx["type"] == "credit":
        for cat, keywords in INCOME_CATS.items():
            for kw in keywords:
                if kw.upper() in desc:
                    return cat
        return "Other Income"
    else:
        for cat, keywords in EXPENSE_CATS.items():
            for kw in keywords:
                if kw.upper() in desc:
                    return cat
        return "Other Expenses"

# ===== PARSE ALL MONTHS =====
monthly_cats = {}
all_transactions = []

for month in MONTH_ORDER:
    pdf = PDFS[month]
    if not os.path.exists(pdf):
        print(f"MISSING: {month}")
        continue
    text = parse_pdf(pdf)
    txs = parse_transactions(text)
    
    cat_totals = {}
    for tx in txs:
        cat = categorize_tx(tx)
        cat_totals[cat] = cat_totals.get(cat, 0) + tx["amount"]
    
    monthly_cats[month] = cat_totals
    all_transactions.extend([{**tx, "month": month} for tx in txs])
    print(f"{month}: {len(txs)} txs, categories: {list(cat_totals.keys())}")

# Save
with open("/home/thomas/Dropbox/finances_cats.json", "w") as f:
    json.dump({"monthly": monthly_cats, "transactions": all_transactions}, f, indent=2, default=str)
print("Saved finances_cats.json")
print(f"Total transactions: {len(all_transactions)}")
