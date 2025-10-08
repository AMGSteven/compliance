# Ping Analysis - User Guide

## Quick Start

### Access the Dashboard

1. Navigate to **Data Management** in the sidebar
2. Click **Ping Analysis**
3. The dashboard will load with default settings (last 30 days, all verticals)

---

## Understanding the Two Tabs

### Tab 1: Same-Vertical Rejections

**What it shows**: Leads that were REJECTED because we already had that phone number in the same vertical within 30 days.

**Data Status**: 
- ⏳ **Starts fresh from today** - Data collection began when this feature was deployed
- 📈 **Check back in 24-48 hours** for initial data
- 📊 **Full analytics in 7-14 days** with meaningful volume

**How to use it**:
1. Wait for data to accumulate
2. Look for lists with high duplicate rates (>20% is concerning)
3. Click the expand arrow (▶) on rows to see which other lists they conflict with
4. Export to CSV for detailed analysis
5. Contact partners about data quality issues

**Example Insights**:
- "List A has 35% duplicate rate - mostly conflicts with List B"
- "Partner X is sending leads we already purchased"
- "Average time between duplicate attempts: 8 days"

---

### Tab 2: Cross-Vertical Duplicates

**What it shows**: Leads that were ACCEPTED despite having duplicate phone numbers because they came from different verticals.

**Data Status**:
- ✅ **Ready NOW** - Historical data available immediately
- 📊 **10,047 phones** with cross-vertical duplicates (last 7 days)
- 🔍 **Shows data source contamination**

**How to use it**:
1. Review list pairs with high phone overlap
2. Identify partners selling same leads to multiple verticals
3. Understand cross-vertical contamination patterns
4. Use sample phones to verify specific cases
5. Export for partner quality discussions

**Example Insights**:
- "Partner X Medicare list shares 250 phones with their Final Expense list"
- "ACA List A has 15% phone overlap with Medicare List B"
- "Same consumers being targeted across multiple verticals"

---

## Using the Filters

### Date Range
- **Default**: Last 30 days
- **Recommended**: 
  - Use 7 days for recent trends
  - Use 30 days for comprehensive analysis
  - Same-Vertical: More days = more data (as it accumulates)
  - Cross-Vertical: More days = slower queries (start with 7 days)

### Vertical Filter
- **All**: Shows data across all verticals
- **ACA**: Filter to only ACA vertical
- **Medicare**: Filter to only Medicare vertical  
- **Final Expense**: Filter to only Final Expense vertical

**When to use**: Focus analysis on specific vertical for targeted insights

### Minimum Duplicate Rate
- **0%**: Show all lists (default)
- **5%**: Show only concerning lists
- **10%**: Show problematic lists
- **20%+**: Show severe quality issues

**Recommendation**: Start with 0% to see full picture, then increase to focus on problems

---

## Understanding the Metrics

### Same-Vertical Rejections Tab

| Column | Meaning | Good | Concerning |
|--------|---------|------|------------|
| **Total Pings** | Accepted + Rejected attempts | High volume | - |
| **Accepted** | Successfully processed leads | High | - |
| **Duplicates** | Rejected duplicate attempts | Low | High |
| **Dupe Rate** | % of pings that were duplicates | <5% | >20% |
| **Unique Phones** | Distinct phone numbers rejected | - | High count |
| **Avg Days** | Days between original and duplicate | Higher | Lower (<7 days) |

**What to look for**:
- 🟢 Green rates (<5%): Excellent data quality
- 🟡 Yellow rates (5-20%): Monitor closely
- 🔴 Red rates (>20%): Quality issue, contact partner

### Cross-Vertical Duplicates Tab

| Column | Meaning |
|--------|---------|
| **List A** | First list with the phone |
| **List B** | Second list with same phone |
| **Shared Phones** | How many phone numbers appear in both |
| **Total Overlaps** | Total number of duplicate occurrences |
| **Sample Phones** | Example phone numbers for verification |

**What to look for**:
- High shared phone counts between same partner's different vertical lists
- Unexpected overlaps between different partners
- Patterns suggesting data source quality issues

---

## Taking Action Based on Data

### High Duplicate Rate in Same List

**Problem**: List A has 30% duplicate rate

**Steps**:
1. Click expand arrow to see which lists it conflicts with
2. If mostly one list → Check if lists should be deduplicated
3. If spread across many lists → Partner data quality issue
4. Contact partner with specific numbers and timeframes
5. Consider adjusting bid or pausing list temporarily

### High Cross-Vertical Overlap

**Problem**: Medicare List A shares 200 phones with Final Expense List B

**Steps**:
1. Check if both lists are from same partner (common)
2. If yes → Expected, consumers interested in multiple products
3. If no → Data sharing between partners (investigate)
4. Review sample phones to verify pattern
5. Consider if targeting same consumers across verticals makes business sense

### Identifying Data Quality Issues

**Red Flags**:
- Duplicate rate >30% consistently
- Duplicates occurring within 1-3 days (scraping/bot behavior)
- Same phones across many unrelated lists
- Sudden spike in duplicate rate for previously clean list

**Actions**:
1. Export CSV with problematic data
2. Document specific examples
3. Schedule call with partner
4. Request data source audit
5. Implement quality gates or reduce bid

---

## Export & Reporting

### CSV Export

**Same-Vertical**:
- Includes all table columns
- One row per list
- Top matched lists in separate columns
- Import into Excel/Google Sheets for pivot tables

**Cross-Vertical**:
- Includes list pair information
- One row per list pair with overlap
- Sample phones included
- Use for partner communications

### Creating Reports

**Weekly Report Example**:
1. Set date range to last 7 days
2. Export both tabs to CSV
3. Sort by duplicate rate (descending)
4. Share top 10 problematic lists with team
5. Track improvements week-over-week

---

## Best Practices

### Daily
- Quick check of summary cards
- Note overall duplicate rate trend
- Watch for sudden spikes

### Weekly
- Review top 10 lists by duplicate rate
- Check cross-vertical patterns
- Export data for team review
- Document findings

### Monthly
- Comprehensive analysis across all verticals
- Partner quality scorecards
- Trend analysis (improving vs. degrading)
- Adjust list routing strategies based on insights

---

## Frequently Asked Questions

**Q: Why is Tab 1 empty?**  
A: Data collection started when this feature was deployed. Check back in 24-48 hours.

**Q: Can I see historical same-vertical rejection data?**  
A: No, rejected leads were never stored before this feature. Only new rejections are tracked.

**Q: Why does Tab 2 have data immediately?**  
A: Cross-vertical duplicates are ACCEPTED leads already in the database. We can analyze them retroactively.

**Q: What's a "good" duplicate rate?**  
A: <5% is excellent, 5-15% is acceptable, 15-30% needs attention, >30% is problematic.

**Q: How often should I check this dashboard?**  
A: Weekly reviews recommended. Daily checks if actively managing data quality issues.

**Q: Can I filter by specific list or partner?**  
A: Use the table's built-in column filters to search/filter by partner name or description.

**Q: What should I do with cross-vertical duplicates?**  
A: These are accepted leads. Review if same consumers should be in multiple verticals. Not necessarily bad, but worth understanding.

**Q: How do I export data?**  
A: Click the "Export to CSV" button above each table. Opens in Excel or Google Sheets.

---

## Technical Support

**Database**: Check `lead_rejections` table directly:
```sql
SELECT * FROM lead_rejections 
ORDER BY created_at DESC 
LIMIT 10;
```

**Logs**: Search server logs for `[REJECTION LOG]` entries

**Issues**: Contact development team with:
- Screenshot of error
- Date/time of issue
- Filters applied
- Browser console logs

---

## Future Enhancements (Optional)

Potential additions based on usage:
- Heat map visualization (matrix grid view)
- Time-series charts (duplicate rate trends)
- Alerts for threshold breaches
- Automated partner quality reports
- Real-time dashboard updates
- Additional rejection reason tracking (state, compliance, DNC)

---

**Last Updated**: October 8, 2025  
**Version**: 1.0.0  
**Status**: Production

