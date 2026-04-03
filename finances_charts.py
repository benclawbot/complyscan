#!/usr/bin/env python3
"""
Thomas Chaffanjet - Financial Dashboard Builder
Full Year: Apr 2025 - Mar 2026
"""
import json, os, subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from datetime import datetime

# ===== MONTHLY VERIFIED TOTALS =====
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

# ===== ESTIMATED CATEGORY BREAKDOWN (CHF) — based on PDF analysis =====
# Format: (housing, health_ins, cantonal_tax, groceries, restaurants, transport, entertainment, kids, phone, clothing, savings, investments, tobacco, other)
CAT_DATA = {
    "Apr 2025":  (2610, 1838, 1436, 1800, 400, 450, 180, 600, 150, 200, 2000, 297, 650, 2621),
    "May 2025":  (2610, 1838, 1436, 3183, 700, 350, 420, 450, 150, 150, 500, 0, 650, 13394),
    "Jun 2025":  (2610, 1838, 1436, 700, 300, 300, 200, 165, 150, 0, 0, 0, 650, 307),
    "Jul 2025":  (2610, 1838, 1436, 1200, 800, 400, 250, 465, 150, 150, 4346, 0, 650, 7414),
    "Aug 2025":  (2610, 1838, 0, 900, 500, 450, 500, 100, 150, 0, 0, 0, 650, 5649),
    "Sep 2025":  (2610, 1838, 1436, 1000, 350, 400, 200, 1400, 150, 0, 9000, 0, 650, 9324),
    "Oct 2025":  (2610, 1838, 1436, 700, 400, 450, 600, 350, 150, 0, 0, 0, 650, 21056),
    "Nov 2025":  (2610, 1838, 0, 1000, 450, 350, 250, 100, 150, 0, 0, 0, 650, 3574),
    "Dec 2025":  (2610, 1838, 1436, 1200, 800, 350, 600, 300, 150, 250, 0, 0, 650, 14571),
    "Jan 2026":  (2610, 1838, 1436, 800, 350, 400, 200, 150, 150, 0, 0, 0, 650, 444),
    "Feb 2026":  (2610, 1838, 1436, 800, 450, 400, 250, 150, 150, 0, 2000, 0, 650, 3933),
    "Mar 2026":  (2610, 1838, 1436, 2800, 550, 500, 350, 250, 150, 0, 0, 0, 650, 5945),
}

CATEGORIES = [
    "Housing", "Health Ins", "Cantonal Tax", "Groceries",
    "Restaurants", "Transport", "Entertainment", "Kids",
    "Phone/Net", "Clothing", "Savings", "Investments", "Tobacco", "Other"
]
COLORS = ["#2c3e50","#8e44ad","#795548","#27ae60","#e67e22","#3498db",
          "#e74c3c","#16a085","#34495e","#e91e63","#607d8b","#00695c","#7f8c8d","#bdc3c7"]

MONTH_SHORT = [m.split()[0][:3] for m in MONTHS]

# Verify totals
for m in MONTHS:
    income, exp, bal = TOTALS[m]
    catsum = sum(CAT_DATA[m])
    print(f"{m}: income={income:.0f} exp={exp:.0f} cat_sum={catsum:.0f}")

# ============================================================
# GENERATE CHARTS
# ============================================================
plt.rcParams['figure.facecolor'] = '#0f1117'
plt.rcParams['axes.facecolor'] = '#1a1a24'
plt.rcParams['text.color'] = '#e8e8f0'
plt.rcParams['axes.labelcolor'] = '#e8e8f0'
plt.rcParams['xtick.color'] = '#9a9ab0'
plt.rcParams['ytick.color'] = '#9a9ab0'
plt.rcParams['axes.spines.top'] = False
plt.rcParams['axes.spines.right'] = False

os.makedirs("/home/thomas/Dropbox/finances_charts", exist_ok=True)

# Chart 1: Monthly Income vs Expenses
fig, ax = plt.subplots(figsize=(13, 5))
x = np.arange(len(MONTHS))
income_vals = [TOTALS[m][0] for m in MONTHS]
exp_vals = [TOTALS[m][1] for m in MONTHS]
net_vals = [income_vals[i] - exp_vals[i] for i in range(len(MONTHS))]

bars1 = ax.bar(x - 0.2, income_vals, 0.4, label="Income", color="#27ae60", alpha=0.9)
bars2 = ax.bar(x + 0.2, exp_vals, 0.4, label="Expenses", color="#e74c3c", alpha=0.9)
ax.plot(x, net_vals, "o-", color="#f39c12", linewidth=2, markersize=6, label="Net", zorder=5)
ax.axhline(0, color='#555', linewidth=0.8, linestyle='--')
ax.set_xticks(x)
ax.set_xticklabels(MONTH_SHORT, fontsize=11)
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'CHF {x/1000:.0f}k'))
ax.set_title("Monthly Income vs Expenses — Apr 2025 to Mar 2026", fontsize=14, fontweight='bold', pad=15)
ax.legend(loc='upper right', framealpha=0.2)
ax.set_ylabel("CHF")
plt.tight_layout()
plt.savefig("/home/thomas/Dropbox/finances_charts/income_vs_expenses.png", dpi=150, bbox_inches='tight')
plt.close()
print("Chart 1 saved")

# Chart 2: Running Balance
fig, ax = plt.subplots(figsize=(13, 4.5))
bal_vals = [TOTALS[m][2] for m in MONTHS]
colors_bal = ['#27ae60' if b > 5000 else '#f39c12' if b > 3000 else '#e74c3c' for b in bal_vals]
ax.bar(x, bal_vals, color=colors_bal, alpha=0.85, width=0.6)
ax.plot(x, bal_vals, "o-", color="#e8e8f0", linewidth=1.5, markersize=5, zorder=5)
ax.axhline(5000, color='#f39c12', linewidth=0.8, linestyle='--', alpha=0.6, label='Warning threshold (5k)')
ax.axhline(3000, color='#e74c3c', linewidth=0.8, linestyle='--', alpha=0.6, label='Critical (3k)')
ax.set_xticks(x)
ax.set_xticklabels(MONTH_SHORT, fontsize=11)
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'CHF {x/1000:.0f}k'))
ax.set_title("PostFinance Running Balance — Apr 2025 to Mar 2026", fontsize=14, fontweight='bold', pad=15)
ax.legend(loc='upper right', framealpha=0.2)
ax.set_ylabel("CHF")
plt.tight_layout()
plt.savefig("/home/thomas/Dropbox/finances_charts/balance.png", dpi=150, bbox_inches='tight')
plt.close()
print("Chart 2 saved")

# Chart 3: Annual Expense Breakdown (stacked bar)
fig, ax = plt.subplots(figsize=(13, 6))
cat_idx = {c: i for i, c in enumerate(CATEGORIES)}
bottom = np.zeros(len(MONTHS))
cat_colors = {c: COLORS[i] for i, c in enumerate(CATEGORIES)}
for cat, color in cat_colors.items():
    vals = [CAT_DATA[m][cat_idx[cat]] for m in MONTHS]
    ax.bar(x, vals, bottom=bottom, label=cat, color=color, width=0.6)
    bottom += np.array(vals)

ax.set_xticks(x)
ax.set_xticklabels(MONTH_SHORT, fontsize=11)
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'CHF {x/1000:.0f}k'))
ax.set_title("Expense Categories Over Time — Apr 2025 to Mar 2026", fontsize=14, fontweight='bold', pad=15)
ax.legend(bbox_to_anchor=(1.01, 1), loc='upper left', fontsize=8, framealpha=0.2)
ax.set_ylabel("CHF")
plt.tight_layout()
plt.savefig("/home/thomas/Dropbox/finances_charts/expenses_stacked.png", dpi=150, bbox_inches='tight')
plt.close()
print("Chart 3 saved")

# Chart 4: Annual totals pie chart
fig, ax = plt.subplots(figsize=(10, 7))
totals_by_cat = [sum(CAT_DATA[m][i] for m in MONTHS) for i in range(len(CATEGORIES))]
# Filter out zeros
non_zero = [(CATEGORIES[i], totals_by_cat[i], COLORS[i]) for i in range(len(CATEGORIES)) if totals_by_cat[i] > 0]
labels, vals, colors = zip(*non_zero)
wedges, texts, autotexts = ax.pie(vals, labels=labels, colors=colors, autopct='%1.1f%%',
                                    pctdistance=0.75, textprops={'fontsize': 9},
                                    wedgeprops={'edgecolor': '#1a1a24', 'linewidth': 1.5})
for t in texts: t.set_color('#e8e8f0')
for a in autotexts: a.set_color('white')
ax.set_title("Annual Expense Breakdown\n(Apr 2025 – Mar 2026)", fontsize=13, fontweight='bold', pad=15)
plt.tight_layout()
plt.savefig("/home/thomas/Dropbox/finances_charts/expenses_pie.png", dpi=150, bbox_inches='tight')
plt.close()
print("Chart 4 saved")

# Chart 5: Monthly category comparison (grouped bar)
fig, ax = plt.subplots(figsize=(14, 6))
N = len(CATEGORIES)
width = 0.065
for i, (cat, color) in enumerate(zip(CATEGORIES, COLORS)):
    vals = [CAT_DATA[m][i] for m in MONTHS]
    ax.bar(x + (i - N/2)*width, vals, width, label=cat, color=color, alpha=0.9)
ax.set_xticks(x)
ax.set_xticklabels(MONTH_SHORT, fontsize=11)
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'CHF {x/1000:.0f}k'))
ax.set_title("Monthly Expense Categories — Apr 2025 to Mar 2026", fontsize=14, fontweight='bold', pad=15)
ax.legend(bbox_to_anchor=(1.01, 1), loc='upper left', fontsize=7.5, framealpha=0.2)
ax.set_ylabel("CHF")
plt.tight_layout()
plt.savefig("/home/thomas/Dropbox/finances_charts/categories_grouped.png", dpi=150, bbox_inches='tight')
plt.close()
print("Chart 5 saved")

# Chart 6: Key metrics trend
fig, axes = plt.subplots(1, 2, figsize=(13, 5))
# Savings rate
savings_rate = [(TOTALS[m][0]-TOTALS[m][1])/TOTALS[m][0]*100 for m in MONTHS]
axes[0].bar(x, savings_rate, color=['#27ae60' if r >= 0 else '#e74c3c' for r in savings_rate], alpha=0.85, width=0.6)
axes[0].axhline(0, color='white', linewidth=0.8)
axes[0].set_xticks(x); axes[0].set_xticklabels(MONTH_SHORT, fontsize=10)
axes[0].set_title("Monthly Savings Rate (%)", fontsize=12, fontweight='bold')
axes[0].set_ylabel("%")
# Fixed vs variable
fixed = [2610 + 1838 + 1436 for m in MONTHS]  # rent + health + tax
variable = [TOTALS[m][1] - fixed[i] for i, m in enumerate(MONTHS)]
axes[1].bar(x, fixed, label='Fixed Costs', color='#34495e', width=0.6, alpha=0.8)
axes[1].bar(x, variable, bottom=fixed, label='Variable Costs', color='#e74c3c', width=0.6, alpha=0.8)
axes[1].set_xticks(x); axes[1].set_xticklabels(MONTH_SHORT, fontsize=10)
axes[1].yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'CHF {x/1000:.0f}k'))
axes[1].set_title("Fixed vs Variable Costs", fontsize=12, fontweight='bold')
axes[1].legend(framealpha=0.2)
plt.tight_layout()
plt.savefig("/home/thomas/Dropbox/finances_charts/key_metrics.png", dpi=150, bbox_inches='tight')
plt.close()
print("Chart 6 saved")

# ===== SUMMARY STATS =====
annual_income = sum(TOTALS[m][0] for m in MONTHS)
annual_expenses = sum(TOTALS[m][1] for m in MONTHS)
annual_net = annual_income - annual_expenses
avg_monthly_exp = annual_expenses / 12
total_savings_est = sum(CAT_DATA[m][10] for m in MONTHS)
total_investment = sum(CAT_DATA[m][11] for m in MONTHS)
total_tobacco = sum(CAT_DATA[m][12] for m in MONTHS)

# Build JS data arrays for the HTML
js_lines = []
for m in MONTHS:
    pairs = ", ".join(f"'{CATEGORIES[i]}': {CAT_DATA[m][i]}" for i in range(len(CATEGORIES)))
    js_lines.append(f"  {{ month: '{m}', values: {{{pairs}}}}}")
js_cat_data = ",\n".join(js_lines)

summary_stats = {
    "annual_income": annual_income,
    "annual_expenses": annual_expenses,
    "annual_net": annual_net,
    "avg_monthly_expenses": avg_monthly_exp,
    "months_deficit": sum(1 for m in MONTHS if TOTALS[m][0] < TOTALS[m][1]),
    "months_surplus": sum(1 for m in MONTHS if TOTALS[m][0] >= TOTALS[m][1]),
    "buffer_lowest": min(TOTALS[m][2] for m in MONTHS),
    "buffer_highest": max(TOTALS[m][2] for m in MONTHS),
    "total_tobacco": total_tobacco,
    "total_savings": total_savings_est,
    "total_investments": total_investment,
}

with open("/home/thomas/Dropbox/finances_charts/summary.json", "w") as f:
    json.dump(summary_stats, f, indent=2)

print(f"\nAnnual income: CHF {annual_income:,.0f}")
print(f"Annual expenses: CHF {annual_expenses:,.0f}")
print(f"Net: CHF {annual_net:,.0f}")
print(f"Avg monthly expenses: CHF {avg_monthly_exp:,.0f}")
print(f"Total tobacco: CHF {total_tobacco:,.0f}")
print("All charts saved!")
