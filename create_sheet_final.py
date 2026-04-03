#!/usr/bin/env python3
"""Manual Google OAuth2 + Sheets creation — with pre-obtained code"""
import requests, json, time, sys, os
from urllib.parse import urlencode, quote

CLIENT_ID = "57246632087-6t39gd8ek3bpdgtoglc7re5vd21m0dt6.apps.googleusercontent.com"
CLIENT_SECRET = "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"
REDIRECT_URI = "https://developers.google.com/oauthplayground"

# Thomas's code from the OAuth callback
CODE = "4/0Aci98E88sH51e4mC43iGfudoBsrXZMD9haaY8OmPamN9p_zFVRa14gJDHVjqDEIzSTfI2w"

def exchange_code(code):
    data = {
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    r = requests.post("https://oauth2.googleapis.com/token", data=data)
    return r.json()

def create_spreadsheet(access_token, title):
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    body = {"properties": {"title": title}, "sheets": [
        {"properties": {"title": "Summary"}},
        {"properties": {"title": "Monthly Data"}},
        {"properties": {"title": "Categories"}}
    ]}
    r = requests.post("https://sheets.googleapis.com/v4/spreadsheets", headers=headers, json=body)
    return r.json()

def update_cells(access_token, spreadsheet_id, range_name, values):
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    body = {"values": values}
    r = requests.put(
        f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{quote(range_name)}",
        headers=headers, json=body, params={"valueInputOption": "USER_ENTERED"}
    )
    return r.json()

print("Exchanging code for tokens...")
tokens = exchange_code(CODE)
if "access_token" not in tokens:
    print("ERROR:", json.dumps(tokens, indent=2))
    sys.exit(1)

print("✅ Got access token!")
access_token = tokens["access_token"]
print(f"   Token type: {tokens.get('token_type')}")
print(f"   Expires in: {tokens.get('expires_in')}s")

with open("/home/thomas/Dropbox/google_tokens.json", "w") as f:
    json.dump(tokens, f, indent=2)
print("Tokens saved to google_tokens.json")

# Create spreadsheet
print("\nCreating spreadsheet...")
ss = create_spreadsheet(access_token, "Thomas Chaffanjon — Financial Dashboard 2025-26")
if "spreadsheetId" not in ss:
    print("ERROR:", ss)
    sys.exit(1)

ss_id = ss["spreadsheetId"]
ss_url = ss["spreadsheetUrl"]
print(f"✅ Spreadsheet: {ss_url}")
print(f"   ID: {ss_id}")

with open("/home/thomas/Dropbox/google_sheet_info.json", "w") as f:
    json.dump({"spreadsheet_id": ss_id, "spreadsheet_url": ss_url}, f, indent=2)

# Monthly data
MONTHS = ["Apr 2025","May 2025","Jun 2025","Jul 2025","Aug 2025","Sep 2025",
          "Oct 2025","Nov 2025","Dec 2025","Jan 2026","Feb 2026","Mar 2026"]
TOTALS = {
    "Apr 2025":  (21357.05, 14032.24, 8964.02),
    "May 2025":  (20733.40, 26331.26, 3366.16),
    "Jun 2025":  (15365.29, 7555.75,  11176.01),
    "Jul 2025":  (17896.67, 21759.67, 7312.70),
    "Aug 2025":  (11690.99, 11346.88, 7656.81),
    "Sep 2025":  (31399.50, 27917.76, 11138.55),
    "Oct 2025":  (21447.45, 29140.08, 3445.92),
    "Nov 2025":  (14016.53, 8972.20,  8490.25),
    "Dec 2025":  (17143.00, 23255.17, 2378.08),
    "Jan 2026":  (13890.68, 6027.91,  10240.85),
    "Feb 2026":  (12896.45, 13716.83, 9420.47),
    "Mar 2026":  (15746.97, 16078.65, 9088.79),
}

# Sheet 1: Summary
print("Writing Summary sheet...")
update_cells(access_token, ss_id, "Summary!A1", [
    ["THOMAS CHAFFANJON — FINANCIAL DASHBOARD 2025/26"],
    [""],
    ["KEY ANNUAL FIGURES"],
    ["Annual Income", "CHF", 213584],
    ["Annual Expenses", "CHF", 206134],
    ["Net Savings", "CHF", 7450],
    ["Savings Rate", "%", 3.5],
    ["Avg Monthly Expenses", "CHF", 17178],
    ["Tobacco (annual)", "CHF", 7800],
    ["Buffer (Mar 2026)", "CHF", 9089],
    ["Months in Deficit", "#", "6 of 12"],
    [""],
    ["CATEGORY ANNUAL TOTALS (CHF)"],
    ["Housing (Rent)", "CHF", 31320],
    ["Health Insurance", "CHF", 22056],
    ["Cantonal Tax", "CHF", 17232],
    ["Groceries", "CHF", 14583],
    ["Tobacco", "CHF", 7800],
    ["Restaurants", "CHF", 5250],
    ["Transport", "CHF", 4800],
    ["Kids Activities", "CHF", 4330],
    ["Entertainment", "CHF", 3900],
    ["Phone/Internet", "CHF", 1800],
])

# Sheet 2: Monthly Data
print("Writing Monthly Data sheet...")
rows = [["Month", "Income (CHF)", "Expenses (CHF)", "Net (CHF)", "Balance (CHF)", "Status"]]
for m in MONTHS:
    inc, exp, bal = TOTALS[m]
    net = round(inc - exp, 2)
    status = "SURPLUS" if net >= 0 else "DEFICIT"
    rows.append([m, round(inc,2), round(exp,2), net, round(bal,2), status])
rows.append(["", "", "", "", "", ""])
rows.append(["ANNUAL", sum(TOTALS[m][0] for m in MONTHS), sum(TOTALS[m][1] for m in MONTHS),
             sum(TOTALS[m][0]-TOTALS[m][1] for m in MONTHS), "", ""])
update_cells(access_token, ss_id, "Monthly Data!A1", rows)

# Sheet 3: Categories
print("Writing Categories sheet...")
cats = [
    ("Housing", [2610,2610,2610,2610,2610,2610,2610,2610,2610,2610,2610,2610]),
    ("Health Insurance", [1838]*12),
    ("Cantonal Tax", [1436,1436,0,1436,0,1436,1436,0,1436,1436,1436,1436]),
    ("Groceries", [1800,3183,700,1200,900,1000,700,1000,1200,800,800,2800]),
    ("Restaurants", [400,700,300,800,500,350,400,450,800,350,450,550]),
    ("Transport", [450,350,300,400,450,400,450,350,350,400,400,500]),
    ("Entertainment", [180,420,200,250,500,200,600,250,600,200,250,350]),
    ("Kids", [600,450,165,465,100,1400,350,100,300,150,150,250]),
    ("Phone/Internet", [150]*12),
    ("Clothing", [200,150,0,150,0,0,0,0,250,0,0,0]),
    ("Savings Transfers", [2000,500,0,4346,0,9000,0,0,0,0,2000,0]),
    ("Tobacco", [650]*12),
]
cat_rows = [["Category"] + MONTHS + ["Annual Total"]]
for cat_name, vals in cats:
    cat_rows.append([cat_name] + vals + [sum(vals)])
update_cells(access_token, ss_id, "Categories!A1", cat_rows)

print(f"\n✅ ALL DATA WRITTEN!")
print(f"   Spreadsheet: {ss_url}")
