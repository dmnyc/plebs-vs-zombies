# Zombie Score Chart Creation Guide

## Overview
This document explains how to create zombie-themed data visualization charts for Plebs vs. Zombies Scout Mode analytics.

## Chart Creation Process

### 1. Data Collection
- Gather Scout Mode scan results over a specific time period
- Calculate zombie score distribution across percentage ranges
- Count number of users (plebs) in each range
- Calculate summary statistics (average, min, max, total scans)

### 2. Chart Structure
The chart is a standalone HTML file with:
- **Framework**: Chart.js for interactive bar charts
- **Styling**: Custom CSS with zombie theme
- **File naming**: `zombie-score-analysis-YYYY-MM-DD-to-DD.html`

### 3. Key Components

#### Visual Design
- Dark gradient background (`#0f0f23` to `#16213e`)
- Creepster font for main title with animated gradient effect
- Color-coded bars: Green (low zombie scores) → Red (high zombie scores)
- Zombie emojis throughout: 🧟‍♂️ 👁️ 🔍 🏹 💀

#### Data Visualization
- X-axis: Zombie score percentage ranges
- Y-axis: Number of plebs
- Interactive tooltips with percentages
- Animated chart loading effects

#### Timestamps & References
- Filename includes date range
- Page title includes date range
- Header shows data period
- Footer timestamp shows generation date
- Tooltips include data period reference

### 4. Example Data Format
```javascript
// Input data format
const ranges = [
    '3.0-6.8%', '6.8-10.6%', '10.6-14.4%', '14.4-18.2%', 
    '18.2-22.0%', '22.0-25.8%', '25.8-29.6%', '29.6-33.4%', 
    '33.4-37.2%', '37.2-41.0%'
];
const counts = [2, 5, 2, 7, 1, 9, 7, 3, 3, 1];
```

### 5. File Structure
```
charts/
├── zombie-score-analysis-2025-09-14-to-20.html
├── README-chart-creation.md (this file)
└── [future chart files...]
```

## Creating New Charts

### Step 1: Collect Data
1. Export Scout Mode scan results for your time period
2. Group zombie scores into percentage ranges
3. Count occurrences in each range
4. Calculate summary statistics

### Step 2: Update Chart
1. Copy the existing chart file as template
2. Update filename with new date range
3. Modify these sections:
   - Page title and headers with new dates
   - Data arrays (`labels` and `data`)
   - Summary statistics in stat cards
   - Timestamp references

### Step 3: Key Code Sections to Update
```javascript
// Update chart data
const data = {
    labels: [/* your ranges */],
    datasets: [{
        data: [/* your counts */]
    }]
};
```

```html
<!-- Update page elements -->
<title>PLEBS VS. ZOMBIES - Zombie Score Analysis (NEW_DATE_RANGE)</title>
<div class="date-range">📅 NEW_DATE_RANGE</div>
<div class="data-note">📊 Analysis based on X Scout Mode scans during this period</div>
```

### Step 4: Test & Verify
1. Open HTML file in browser
2. Check all dates are updated
3. Verify chart data matches your input
4. Test interactive elements (hover tooltips)

## Technical Details

### Dependencies
- Chart.js (loaded from CDN)
- Google Fonts: Creepster (horror font) + Inter (body text)

### Color Scheme
- Background: Dark blue gradient
- Primary accent: `#10b981` (green)
- Warning/highlight: `#fbbf24` (yellow)
- Chart bars: Green → Yellow → Red gradient based on zombie score severity

### Responsive Design
- Mobile-friendly responsive layout
- Flexible grid for statistics cards
- Scalable chart container

## Example Use Cases

1. **Weekly Reports**: Show zombie score trends over 7-day periods
2. **Monthly Analysis**: Broader view of community zombie health
3. **Comparison Charts**: Side-by-side analysis of different time periods
4. **Special Events**: Before/after analysis of major Nostr events

## Notes
- Charts are fully self-contained (no external file dependencies)
- Perfect for social media sharing
- Can be hosted anywhere or opened locally
- Maintains consistent branding with main application