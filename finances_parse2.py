#!/usr/bin/env python3
"""
PostFinance Dashboard Generator
Uses verified monthly totals + generates category breakdown + HTML dashboard
"""

import re, os, json
import subprocess
from pathlib import Path

STATEMENTS_DIR = Path(
    os.getenv(
        "POSTFINANCE_STATEMENTS_DIR",
        str(Path.home() / "Documents" / "postfinance-statements"),
    )
)


def _statement_file(name: str) -> str:
    return str(STATEMENTS_DIR / name)

# ============================================================
# VERIFIED MONTHLY TOTALS (from full PDF analysis)
# ============================================================
MONTH_ORDER = ["Apr 2025","May 2025","Jun 2025","Jul 2025","Aug 2025","Sep 2025",
                "Oct 2025","Nov 2025","Dec 2025","Jan 2026","Feb 2026","Mar 2026"]

MONTHLY_TOTALS = {
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

# ============================================================
# CATEGORY PATTERNS
# ============================================================
CATEGORIES = {
    "Housing (Rent)":      {"patterns": [r"LOYER", r"HELVESTRASSE"], "color": "#c0392b"},
    "Health Insurance":     {"patterns": [r"AVENIR", r"MUTUEL ASSURANCE", r"3ÈME PILIER", r"3ÈME PILLIER", r"DR\. PoncIN", r"CAISSE POUR MÉDECINS", r"TOMATIS", r"GENERALIA"], "color": "#8e44ad"},
    "Groceries":            {"patterns": [r"MIGROS", r"COOP ", r"DENNER", r"LIDL", r"MANOR AG", r"CHICORÉE", r"EPICIER", r"MARCHANDISES", r"MIGRO"], "color": "#27ae60"},
    "Restaurants & Café":   {"patterns": [r"RESTAURANT", r"PAYPAL.*UBEREATS", r"MCDONALD", r"PACH.*KEBAB", r"PIZZA", r"GELATO", r"TEA ROOM", r"CAFÉ", r"CAFE", r"POOLHOUSE", r"BRASSERIE", r"BISTROT", r"AUBERGE", r"BOULANGER", r"FERNAND", r"CHARLPORT", r"MANOR.*RESTO"],
                            "color": "#e67e22"},
    "Transport":            {"patterns": [r"SBB M", r"TWINT.*SBB", r"MIGROL", r"AMAG ", r"PARKING", r"AUTOROUTE", r"CARBURANT", r"TC (?!CH)", r"SOCAR", r"OIL", r" Car ", r" Essence"],
                            "color": "#2980b9"},
    "Entertainment":        {"patterns": [r"NETFLIX", r"DISNEY", r"XBOX", r"MICROSOFT.*XBOX", r"AMAZON", r"STEAM", r"PLAYSTATION", r"ALEXPRESS", r"IKEA", r"DECATHLON"],
                            "color": "#e74c3c"},
    "Kids":                 {"patterns": [r"TENNIS ENFANT", r"SCOUT", r"ECOLE", r"ENGLISH", r"TREASURE KIDS", r"FUN WITH", r"LEGO", r"JACK CHAF", r"NOAH CHAF", r"ALEXANDRA CHAF"],
                            "color": "#16a085"},
    "Phone & Subs":         {"patterns": [r"SALT MOBILE", r"SALT FIBER", r"GOOGLE ONE", r"Netflix"],
                            "color": "#2c3e50"},
    "Health & Pharmacy":     {"patterns": [r"PHARMACIE", r"DOCTOR", r"MÉDECIN", r"CLINIQUE", r"DENTIST"],
                            "color": "#1565c0"},
    "Clothing":             {"patterns": [r"C&A", r"ZARA", r"H&M", r"PRIMARK", r"SPORTS", r"DECATHLON", r"BENETTON"],
                            "color": "#e91e63"},
    "Taxes":                {"patterns": [r"IMPÔTS", r"ETAT DE VAUD", r"IMPOT", r"COMMUNE"],
                            "color": "#5d4037"},
    "Savings Transfers":     {"patterns": [r"TRANSFERT.*EPARGNE", r"EPARGNE MARS", r"REMBOURSEMENT.*AVANCE", r"AVS 2ÈME", r"AVS 3ÈME", r"REMB POUR AVANCE"],
                            "color": "#607d8b"},
    "Investments":          {"patterns": [r"INVEST LIKE", r"TRADEFURY", r"FX", r"FOREX", r"BTC", r"BITCOIN"],
                            "color": "#00695c"},
    "Tobacco":              {"patterns": [r"SMOKE", r"CIGAR", r"BOUCHERIE"],
                            "color": "#795548"},
    "Hair & Beauty":         {"patterns": [r"COIFFURE", r"HAIR", r"BARBER", r"EPILATION"],
                            "color": "#ab7967"},
}

INCOME_CATS = {
    "Salary":              {"patterns": [r"SALARY PAYMENT", r"PRIME INTERNATIONAL"], "color": "#27ae60"},
    "Family Allowances":   {"patterns": [r"ALLOCATIONS FAMILIALES", r"FERRIA"], "color": "#8bc34a"},
    "AVS Refunds":         {"patterns": [r"AVS.*TRIMESTRE", r"AVANCE POUR AVS"], "color": "#00bcd4"},
    "Insurance Refunds":   {"patterns": [r"REMBOURSEMENT", r"REIMBURSEMENT", r"DECOMPTE", r"AIDE ET SOUTIEN"], "color": "#0097a7"},
}

def parse_pdf_transactions(pdf_path):
    result = subprocess.run(['pdftotext', '-layout', pdf_path, '-'],
                          capture_output=True, text=True, errors='replace')
    return result.stdout

def categorize(desc_upper, amount, is_credit):
    if is_credit:
        for cat, info in INCOME_CATS.items():
            for pat in info["patterns"]:
                if re.search(pat, desc_upper, re.IGNORECASE):
                    return cat
        return "Other Income"
    else:
        for cat, info in CATEGORIES.items():
            for pat in info["patterns"]:
                if re.search(pat, desc_upper, re.IGNORECASE):
                    return cat
        return "Other Expenses"

def extract_transactions_from_text(text):
    """Extract debits and credits with their descriptions."""
    transactions = []
    lines = text.split('\n')
    
    for i, line in enumerate(lines):
        line_clean = re.sub(r'\s+', ' ', line.strip())
        
        # Credit entries
        credit_m = re.search(r"CRÉDIT\s+([\d' .]+[.,]\d{2})\s+(\d{2}[./]\d{2}[./]\d{2,4})", line, re.IGNORECASE)
        if credit_m:
            amt_str = credit_m.group(1).replace("'", "").replace(" ", "").replace(",", ".")
            try:
                amt = float(amt_str)
            except:
                continue
            # Find description in surrounding lines
            desc = ""
            for j in range(max(0, i-4), i+4):
                if j < len(lines):
                    dl = lines[j].strip()
                    dl_clean = re.sub(r'\s+', ' ', dl).strip()
                    if dl_clean and not re.match(r'^[\s\d.,\-]+$', dl_clean) and len(dl_clean) > 5:
                        if any(kw in dl_clean.upper() for kw in ["SALARY", "PRIME", "ALLOC", "FERRIA", "REMBOURS", "AVS", "AVENIR", "REF"]):
                            desc = dl_clean
                            break
                        elif not desc and dl_clean not in ['', credit_m.group(0)]:
                            desc = dl_clean
            transactions.append({"type": "credit", "amount": amt, "description": desc})
            continue
        
        # Debit entries
        debit_m = re.search(r"^\s*([\d' .]+[.,]\d{2})\s+\d{2}[./]\d{2}[./]\d{2,4}\s*$", line_clean)
        if debit_m:
            amt_str = debit_m.group(1).replace("'", "").replace(" ", "").replace(",", ".")
            try:
                amt = float(amt_str)
            except:
                continue
            if amt <= 0:
                continue
            # Get description
            desc = ""
            for j in range(max(0, i-5), i):
                if j < len(lines):
                    dl = lines[j].strip()
                    dl_clean = re.sub(r'\s+', ' ', dl).strip()
                    if dl_clean and not re.match(r'^[\s\d.,\-/]+$', dl_clean) and len(dl_clean) > 5 and len(dl_clean) < 100:
                        desc = dl_clean
                        break
            transactions.append({"type": "debit", "amount": amt, "description": desc})
    
    return transactions

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

# ============================================================
# EXTRACT AND CATEGORIZE
# ============================================================
all_monthly_cat = {}

for month in MONTH_ORDER:
    pdf = PDFS[month]
    if not os.path.exists(pdf):
        continue
    text = parse_pdf_transactions(pdf)
    txs = extract_transactions_from_text(text)
    
    cat_totals = {}
    cat_colors = {}
    for cat_info in {**CATEGORIES, **INCOME_CATS}.items():
        pass
    
    # Categorize each transaction
    cat_totals = {}
    for tx in txs:
        desc_upper = tx["description"].upper() if tx["description"] else ""
        is_credit = tx["type"] == "credit"
        cat = categorize(desc_upper, tx["amount"], is_credit)
        cat_totals[cat] = cat_totals.get(cat, 0) + tx["amount"]
        # Get color
        if cat in INCOME_CATS:
            cat_totals[cat + "_color"] = INCOME_CATS[cat]["color"]
        elif cat in CATEGORIES:
            cat_totals[cat + "_color"] = CATEGORIES[cat]["color"]
    
    all_monthly_cat[month] = cat_totals
    print(f"{month}: {len(txs)} transactions")

# Save
with open("/home/thomas/Dropbox/finances_categories.json", "w") as f:
    json.dump(all_monthly_cat, f, indent=2, default=str)
print("Done")
