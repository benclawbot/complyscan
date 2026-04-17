#!/usr/bin/env python3
"""
PostFinance Statement Analyzer
Parses 12 months of Thomas Chaffanjon's PostFinance statements,
categorizes all transactions, and generates an HTML dashboard.
"""

import os
import re
import subprocess
from datetime import datetime
from pathlib import Path

STATEMENTS_DIR = Path(
    os.getenv(
        "POSTFINANCE_STATEMENTS_DIR",
        str(Path.home() / "Documents" / "postfinance-statements"),
    )
)


def _statement_file(name: str) -> str:
    return str(STATEMENTS_DIR / name)

# PDFs: Apr 2025 - Mar 2026
PDFS = {
    "Apr 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025050104371092---94f94873-d7d8-47d1-a6d3-4d7498798f4d.pdf"),
    "May 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025060102552617---f4eb76e9-5d68-48b7-8f03-ea058ac61483.pdf"),
    "Jun 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025070104041121---a4500456-f10e-4456-b9d8-b3d64a275599.pdf"),
    "Jul 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025080104591559---740b5642-47dd-4242-bffb-cc56b0cf5984.pdf"),
    "Aug 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025090104071916---04e284a5-a4f7-49dd-8731-657e880da266.pdf"),
    "Sep 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025090104071916---f188ab19-d081-48d1-b4d5-eb8cddc593e6.pdf"),
    "Oct 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025100103502664---45186a93-c682-4e33-957c-6320d6561b7d.pdf"),
    "Nov 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025110103321781---958c36b0-b637-4de4-88f6-de916aa45820.pdf"),
    "Dec 2025": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2025120105161218---14ef6e67-77e5-4cce-a2bb-73a98d15f11d.pdf"),
    "Jan 2026": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2026010113212202---675ef013-fff2-4cef-9c3e-cb442ae6edc2.pdf"),
    "Feb 2026": _statement_file("REP_P_CH1809000000127269836_1105749371_0_2026020105242707---d82e9b0a-9f0a-4c1f-8262-fbc9858fec7a.pdf"),
    "Mar 2026": _statement_file("REP_P_CH1809000000127269836_1138321291_0_2026040111371289---11b592e2-bc68-4851-ad5d-ed9237b3f017.pdf"),
}

MONTH_ORDER = ["Apr 2025","May 2025","Jun 2025","Jul 2025","Aug 2025","Sep 2025",
                "Oct 2025","Nov 2025","Dec 2025","Jan 2026","Feb 2026","Mar 2026"]

# Category definitions: (keyword_regexes, is_credit)
CATEGORIES = {
    "Housing (Rent)": {
        "patterns": [r"LOYER", r"HELVESTRASSE", r"Loyer"],
        "is_expense": True,
        "color": "#e74c3c",
    },
    "Health Insurance": {
        "patterns": [r"AVENIR ASSURANCE", r"MUTUEL", r"GENERALIA", r"3ÈME PILIER", r"3ÈME PILLIER", r"DR\. (PONCIN|WIEDMER)", r"CAISSE POUR MÉDECINS", r"TOMATIS", r"AVENIR ASSURANCE MALADIE"],
        "is_expense": True,
        "color": "#9b59b6",
    },
    "Groceries": {
        "patterns": [r"MIGROS", r"COOP ", r"DENNER", r"LIDL", r"MANOR", r"CHICORÉE", r"EPICIER", r"MARCHANDISES"],
        "is_expense": True,
        "color": "#2ecc71",
    },
    "Restaurants & Takeaway": {
        "patterns": [r"RESTAURANT", r"TAKE AWAY", r"PAYPAL.*UBEREATS", r"MCDONALD", r"KEBAB", r"PACH.*K.*BAB", r"PIZZA", r"MANU GELATO", r"TEA ROOM", r"CAFÉ", r"CAFE", r"BOULANGER", r"EPICERIE", r"FERNAND", r"POOLHOUSE"],
        "is_expense": True,
        "color": "#f39c12",
    },
    "Transport": {
        "patterns": [r"SBB ", r"SBB M", r"TWINT.*SBB", r"MIGROL", r"GARAGE", r"PARKING", r"AUTOROUTE", r"CARBURANT", r"AMAG ", r"TC (?!CH)", r"CARTE", r" Essence", r"ESSENCE"],
        "is_expense": True,
        "color": "#3498db",
    },
    "Entertainment": {
        "patterns": [r"NETFLIX", r"DISNEY", r"XBOX", r"MICROSOFT", r"AMAZON", r"STEAM", r"PLAYSTATION", r"GOOGLE PAY.*ACHAT", r"ALEXPRESS", r"IKEA", r"DECATHLON"],
        "is_expense": True,
        "color": "#e67e22",
    },
    "Kids Activities": {
        "patterns": [r"TENNIS ENFANT", r"SWISS", r"ECOLE", r"SCHOOL", r"KID", r"ENGLISH", r"TREASURE KIDS", r"FUN WITH", r"LEGO", r"PLAY"],
        "is_expense": True,
        "color": "#1abc9c",
    },
    "Phone & Internet": {
        "patterns": [r"SALT MOBILE", r"SALT FIBER", r"GOOGLE ONE", r"iCloud", r"icloud"],
        "is_expense": True,
        "color": "#34495e",
    },
    "Tobacco & Vices": {
        "patterns": [r"SMOKE", r"CIGAR", r"TOBACCO", r"BOUCHERIE", r"BOULANGERIE", r"ALCOOL", r"WINE", r"BIÈRE", r"BISTRO", r"HOTEL", r"HÔTEL"],
        "is_expense": True,
        "color": "#7f8c8d",
    },
    "Clothing": {
        "patterns": [r"C&A", r"ZARA", r"H&M", r"DESIGNERS", r"MANOR AG", r"PRIMARK", r"SPORTS", r"DECATHLON", r"BENETTON"],
        "is_expense": True,
        "color": "#e91e63",
    },
    "Taxes & Govt": {
        "patterns": [r"IMPÔTS", r"IMPOTS", r"ETAT DE VAUD", r"COMMUNE", r"TAX", r"DÉPARTEMENT"],
        "is_expense": True,
        "color": "#795548",
    },
    "Savings & Transfers": {
        "patterns": [r"TRANSFERT SUR COMPTE.*EPARGNE", r"EPARGNE", r"SAVINGS", r"3ÈME PILIER.*AVANCE", r"REMBOURSEMENT.*AVANCE", r"AVS.*2ÈME TRIMESTRE", r"AVS.*3ÈME TRIMESTRE", r"REMB POUR AVANCE"],
        "is_expense": True,
        "color": "#607d8b",
    },
    "Investments": {
        "patterns": [r"INVEST LIKE", r"TRADING", r"BROKER", r"TRADEFURY", r"FX", r"FOREX"],
        "is_expense": True,
        "color": "#00695c",
    },
    "Healthcare & Pharmacy": {
        "patterns": [r"PHARMACIE", r"DOCTOR", r"MÉDECIN", r"CLINIQUE", r"HÔPITAL", r"HOSPITAL", r"DENTIST", r"MÉDICAL"],
        "is_expense": True,
        "color": "#1565c0",
    },
    "Salary (Incoming)": {
        "patterns": [r"SALARY PAYMENT", r"PRIME INTERNATIONAL", r"PRIME INTERNATION"],
        "is_expense": False,
        "color": "#27ae60",
    },
    "Family Allowances (AVS)": {
        "patterns": [r"ALLOCATIONS FAMILIALES", r"ALLOCATIONS FAMILIALE", r"FERRIA"],
        "is_expense": False,
        "color": "#8bc34a",
    },
    "Insurance Refunds": {
        "patterns": [r"REMBOURSEMENT", r"DECOMPTE AVENIR", r"AVENIR.*REMBOURSEMENT", r"REIMBURSEMENT", r"AIDE ET SOUTIEN"],
        "is_expense": False,
        "color": "#00bcd4",
    },
}

def parse_pdf(path):
    result = subprocess.run(['pdftotext', '-layout', path, '-'],
                          capture_output=True, text=True, errors='replace')
    return result.stdout

def extract_transactions(text):
    """Extract all credit and debit transactions with descriptions."""
    transactions = []
    lines = text.split('\n')
    for i, line in enumerate(lines):
        # Match debit lines: amount in first part, followed by date
        debit_match = re.match(r"^\s*(-?[\d' ]+[.,]\d{2})\s+(\d{2}[./]\d{2}[./]\d{2,4})\s*$", line.strip())
        if not debit_match:
            debit_match = re.match(r"^\s*(-?[\d' ]+[.,]\d{2})\s+(\d{2}[./]\d{2}[./]\d{2,4})\s*$", line.strip())
        if not debit_match:
            debit_match = re.search(r"^\s*(-?[\d' ]+[.,]\d{2})\s+\d{2}[./]\d{2}[./]\d{2,4}\s*$", line.strip())

        # Look for credits
        credit_match = re.search(r"CRÉDIT\s+(-?[\d' ]+[.,]\d{2})\s+(\d{2}[./]\d{2}[./]\d{2,4})", line)
        if credit_match:
            amt_str = credit_match.group(1).replace("'", "").replace(" ", "").replace("'", "")
            amt = float(amt_str.replace(",", "."))
            date = credit_match.group(2)
            # Get description from nearby lines
            desc = ""
            for j in range(max(0, i-3), i+3):
                if j < len(lines):
                    dline = lines[j].strip()
                    if any(kw in dline.upper() for kw in ["DONNEUR", "PRIME", "SALARY", "PAYMENT", "ALLOC", "FERRIA", "REMBOURS", "AVENIR", "MUTUEL", "REF"]):
                        desc = re.sub(r'\s+', ' ', dline).strip()
                        break
                    elif dline and not re.match(r'^[\d\s.,\-]+$', dline) and len(dline) > 5:
                        desc = dline
            transactions.append({"type": "credit", "amount": amt, "date": date, "description": desc, "category": None})
            continue

        # Debit: look for large amount followed by description pattern
        for debit_re in [r"^\s*([\d' ]+[.,]\d{2})\s+(\d{2}[./]\d{2}[./]\d{2,4})", r"^\s*([\d' ]+[.,]\d{2})\s+\d{2}[./]\d{2}[./]\d{2,4}", r"DEBIT\s+([\d' ]+[.,]\d{2})"]:
            dm = re.search(debit_re, line)
            if dm:
                amt_str = dm.group(1).replace("'", "").replace(" ", "").replace("'", "")
                try:
                    amt = float(amt_str.replace(",", "."))
                except:
                    continue
                if amt > 0:
                    # Find description
                    desc = ""
                    for j in range(max(0, i-5), i+1):
                        if j < len(lines):
                            dline = lines[j].strip()
                            if dline and not re.match(r"^[\d\s.,\-/]+$", dline) and len(dline) > 4:
                                desc = re.sub(r'\s+', ' ', dline).strip()
                                break
                    transactions.append({"type": "debit", "amount": amt, "date": "", "description": desc, "category": None})
                    break

    return transactions

def categorize_transaction(tx):
    desc = tx["description"].upper()
    for cat, info in CATEGORIES.items():
        for pat in info["patterns"]:
            if re.search(pat, desc, re.IGNORECASE):
                return cat
    return "Other"

def parse_totals(text):
    """Extract monthly totals from last page of statement."""
    totals = {}
    # Look for "Total ... Credits ... Debits"
    m = re.search(r"Total\s+([\d' ]+[.,]\d{2})\s+([\d' ]+[.,]\d{2})", text)
    if m:
        income = float(m.group(1).replace("'", "").replace(" ", "").replace(",", "."))
        expenses = float(m.group(2).replace("'", "").replace(" ", "").replace(",", "."))
        totals['income'] = income
        totals['expenses'] = expenses
    # Look for closing balance
    m2 = re.search(r"Etat de compte\s*\n?\s*([\d' ]+[.,]\d{2})\s*$", text, re.MULTILINE)
    if m2:
        totals['balance'] = float(m2.group(1).replace("'", "").replace(" ", "").replace(",", "."))
    return totals

# ============================================================
# PARSE ALL MONTHS
# ============================================================
monthly_data = {}

for month, pdf_path in PDFS.items():
    if not os.path.exists(pdf_path):
        print(f"Missing: {month} -> {pdf_path}")
        continue
    text = parse_pdf(pdf_path)
    totals = parse_totals(text)
    transactions = extract_transactions(text)
    for tx in transactions:
        cat = categorize_transaction(tx)
        tx["category"] = cat
    monthly_data[month] = {
        "totals": totals,
        "transactions": transactions,
    }
    print(f"Parsed {month}: income={totals.get('income',0):.2f} expenses={totals.get('expenses',0):.2f} balance={totals.get('balance',0):.2f} tx_count={len(transactions)}")

# Save parsed data
import json
with open("/home/thomas/Dropbox/finances_data.json", "w") as f:
    # Convert to serializable
    data_to_save = {}
    for month, data in monthly_data.items():
        data_to_save[month] = {
            "totals": data["totals"],
            "transactions": data["transactions"]
        }
    json.dump(data_to_save, f, indent=2, default=str)

print("Data saved to finances_data.json")
