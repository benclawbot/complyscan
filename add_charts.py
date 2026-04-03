#!/usr/bin/env python3
"""Add charts to the existing Google Sheet — working chart types only"""
import json, requests

with open("google_tokens.json") as f:
    tokens = json.load(f)
access_token = tokens["access_token"]
ss_id = "17agLyw0P_pV04ha7g-f52VixnOStxxa-KEexrZBKuMM"
headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

BLUE   = {"red": 0.26,  "green": 0.52,  "blue": 0.96}
RED    = {"red": 0.92,  "green": 0.26,  "blue": 0.21}
GREEN  = {"red": 0.20,  "green": 0.65,  "blue": 0.33}
ORANGE = {"red": 0.96,  "green": 0.62,  "blue": 0.07}
PURPLE = {"red": 0.61,  "green": 0.35,  "blue": 0.71}

# ── Chart 1: Monthly Income vs Expenses — COLUMN on Monthly Data ──────────────
chart1 = {
    "addChart": {
        "chart": {
            "spec": {
                "title": "Monthly Income vs Expenses (CHF)",
                "basicChart": {
                    "chartType": "COLUMN",
                    "legendPosition": "BOTTOM_LEGEND",
                    "axis": [
                        {"position": "LEFT_AXIS", "title": "CHF"},
                        {"position": "BOTTOM_AXIS", "title": ""}
                    ],
                    "domains": [{
                        "domain": {
                            "sourceRange": {
                                "sources": [{
                                    "sheetId": 183240811,
                                    "startRowIndex": 0,
                                    "endRowIndex": 13,
                                    "startColumnIndex": 0,
                                    "endColumnIndex": 1
                                }]
                            }
                        }
                    }],
                    "series": [
                        {
                            "series": {"sourceRange": {"sources": [{
                                "sheetId": 183240811, "startRowIndex": 1, "endRowIndex": 13,
                                "startColumnIndex": 1, "endColumnIndex": 2
                            }]}},
                            "targetAxis": "LEFT_AXIS",
                            "color": BLUE
                        },
                        {
                            "series": {"sourceRange": {"sources": [{
                                "sheetId": 183240811, "startRowIndex": 1, "endRowIndex": 13,
                                "startColumnIndex": 2, "endColumnIndex": 3
                            }]}},
                            "targetAxis": "LEFT_AXIS",
                            "color": RED
                        }
                    ],
                    "headerCount": 1
                }
            },
            "position": {
                "overlayPosition": {
                    "anchorCell": {"sheetId": 183240811, "rowIndex": 15, "columnIndex": 0},
                    "widthPixels": 900,
                    "heightPixels": 400
                }
            }
        }
    }
}

# ── Chart 2: Net balance — LINE on Monthly Data ───────────────────────────────
chart2 = {
    "addChart": {
        "chart": {
            "spec": {
                "title": "Monthly Net Balance (CHF)",
                "basicChart": {
                    "chartType": "LINE",
                    "legendPosition": "BOTTOM_LEGEND",
                    "axis": [{"position": "LEFT_AXIS", "title": "CHF"}],
                    "domains": [{
                        "domain": {
                            "sourceRange": {
                                "sources": [{
                                    "sheetId": 183240811,
                                    "startRowIndex": 0,
                                    "endRowIndex": 13,
                                    "startColumnIndex": 0,
                                    "endColumnIndex": 1
                                }]
                            }
                        }
                    }],
                    "series": [{
                        "series": {"sourceRange": {"sources": [{
                            "sheetId": 183240811, "startRowIndex": 1, "endRowIndex": 13,
                            "startColumnIndex": 4, "endColumnIndex": 5
                        }]}},
                        "targetAxis": "LEFT_AXIS",
                        "color": GREEN
                    }],
                    "headerCount": 1
                }
            },
            "position": {
                "overlayPosition": {
                    "anchorCell": {"sheetId": 183240811, "rowIndex": 15, "columnIndex": 8},
                    "widthPixels": 700,
                    "heightPixels": 400
                }
            }
        }
    }
}

# ── Chart 3: Category totals — BAR on Categories ──────────────────────────────
chart3 = {
    "addChart": {
        "chart": {
            "spec": {
                "title": "Annual Expense Breakdown by Category (CHF)",
                "basicChart": {
                    "chartType": "BAR",
                    "legendPosition": "NO_LEGEND",
                    "axis": [{"position": "BOTTOM_AXIS", "title": "CHF"}],
                    "domains": [{
                        "domain": {
                            "sourceRange": {
                                "sources": [{
                                    "sheetId": 1327246075,
                                    "startRowIndex": 1,
                                    "endRowIndex": 13,
                                    "startColumnIndex": 0,
                                    "endColumnIndex": 1
                                }]
                            }
                        }
                    }],
                    "series": [{
                        "series": {"sourceRange": {"sources": [{
                            "sheetId": 1327246075, "startRowIndex": 1, "endRowIndex": 13,
                            "startColumnIndex": 13, "endColumnIndex": 14
                        }]}},
                        "targetAxis": "BOTTOM_AXIS",
                        "color": ORANGE
                    }],
                    "headerCount": 1
                }
            },
            "position": {
                "overlayPosition": {
                    "anchorCell": {"sheetId": 1327246075, "rowIndex": 15, "columnIndex": 0},
                    "widthPixels": 700,
                    "heightPixels": 500
                }
            }
        }
    }
}

# ── Chart 4: Key KPIs — BAR on Summary ─────────────────────────────────────────
chart4 = {
    "addChart": {
        "chart": {
            "spec": {
                "title": "Annual KPIs (CHF)",
                "basicChart": {
                    "chartType": "BAR",
                    "legendPosition": "NO_LEGEND",
                    "axis": [{"position": "BOTTOM_AXIS", "title": "CHF"}],
                    "domains": [{
                        "domain": {
                            "sourceRange": {
                                "sources": [{
                                    "sheetId": 1122522027,
                                    "startRowIndex": 3,
                                    "endRowIndex": 6,
                                    "startColumnIndex": 0,
                                    "endColumnIndex": 1
                                }]
                            }
                        }
                    }],
                    "series": [{
                        "series": {"sourceRange": {"sources": [{
                            "sheetId": 1122522027, "startRowIndex": 3, "endRowIndex": 6,
                            "startColumnIndex": 2, "endColumnIndex": 3
                        }]}},
                        "targetAxis": "BOTTOM_AXIS",
                        "color": PURPLE
                    }],
                    "headerCount": 0
                }
            },
            "position": {
                "overlayPosition": {
                    "anchorCell": {"sheetId": 1122522027, "rowIndex": 0, "columnIndex": 5},
                    "widthPixels": 500,
                    "heightPixels": 280
                }
            }
        }
    }
}

payload = {"requests": [chart1, chart2, chart3, chart4]}
r = requests.post(
    f"https://sheets.googleapis.com/v4/spreadsheets/{ss_id}:batchUpdate",
    headers=headers, json=payload
)
print("HTTP Status:", r.status_code)
result = r.json()
if "replies" in result:
    labels = ["Income vs Expenses (COLUMN)", "Net Balance (LINE)",
              "Category Breakdown (BAR)", "KPIs (BAR)"]
    for i, reply in enumerate(result["replies"]):
        if "addChart" in reply:
            cid = reply["addChart"]["chart"]["chartId"]
            print(f"  ✅ Chart {i+1} [{labels[i]}]: chartId={cid}")
else:
    print("ERROR:", json.dumps(result, indent=2))
