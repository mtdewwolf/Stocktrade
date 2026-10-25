// =========================================================================
// 1. DETERMINISTIC HISTORICAL DATASET & TRADING CALENDAR (1980-01-02 to 2026-10-23)
// =========================================================================
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TRADING_DATES = [];
const DATE_TO_INDEX = {};
(function buildTradingCalendar() {
  const start = new Date(Date.UTC(1980, 0, 2));
  const end = new Date(Date.UTC(2026, 9, 23));
  const cur = new Date(start);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const y = cur.getUTCFullYear();
      const m = cur.getUTCMonth() + 1;
      const d = cur.getUTCDate();
      const iso = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const isHoliday = (m === 1 && d === 1) ||
                        (m === 7 && d === 4) ||
                        (m === 12 && d === 25) ||
                        (y === 2001 && m === 9 && d >= 11 && d <= 14);
      if (!isHoliday) {
        const idx = TRADING_DATES.length;
        DATE_TO_INDEX[iso] = idx;
        TRADING_DATES.push({
          iso,
          year: y,
          month: m,
          day: d,
          pretty: dayNames[dow] + ', ' + monthNames[m - 1] + ' ' + d + ', ' + y
        });
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
})();

const TOTAL_DAYS = TRADING_DATES.length;

function findDayIndex(isoTarget) {
  if (DATE_TO_INDEX[isoTarget] !== undefined) return DATE_TO_INDEX[isoTarget];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    if (TRADING_DATES[i].iso >= isoTarget) return i;
  }
  return TOTAL_DAYS - 1;
}

const FED_RATE_WAYPOINTS = [
  ['1980-01-02', 14.0], ['1981-06-01', 19.1], ['1982-12-01', 8.9],
  ['1984-08-01', 11.6], ['1986-12-01', 6.0],  ['1989-05-01', 9.8],
  ['1992-12-01', 3.0],  ['1995-07-01', 5.8],  ['2000-06-01', 6.5],
  ['2003-06-01', 1.0],  ['2006-07-01', 5.25], ['2008-12-16', 0.15],
  ['2015-12-01', 0.25], ['2018-12-01', 2.40], ['2020-03-16', 0.10],
  ['2022-03-15', 0.25], ['2023-07-26', 5.33], ['2025-06-01', 4.25],
  ['2026-10-23', 3.75]
].map(([dt, r]) => [findDayIndex(dt), r]);

function getFedRateAtDay(dayIdx) {
  for (let i = 0; i < FED_RATE_WAYPOINTS.length - 1; i++) {
    const [d0, r0] = FED_RATE_WAYPOINTS[i];
    const [d1, r1] = FED_RATE_WAYPOINTS[i + 1];
    if (dayIdx >= d0 && dayIdx <= d1) {
      const t = (dayIdx - d0) / Math.max(1, d1 - d0);
      return r0 + (r1 - r0) * t;
    }
  }
  return 3.75;
}

function getCpiDeflatorAtDay(dayIdx) {
  const yr = 1980 + (dayIdx / TOTAL_DAYS) * 46.8;
  if (yr <= 1983) return 1.0 + (yr - 1980) * 0.088;
  if (yr <= 1990) return 1.264 + (yr - 1983) * 0.045;
  if (yr <= 2020) return 1.579 + (yr - 1990) * 0.056;
  return 3.259 + (yr - 2020) * 0.102;
}

// =========================================================================
// 2. 98-ASSET HISTORICAL UNIVERSE (1980-2026)
// =========================================================================
const ASSETS_CONFIG = [
  // --- MACRO / INDEX / GOLD / CRYPTO ---
  {
    symbol: 'SPX', name: 'S&P 500 Index Fund', sector: 'Macro', divYield: 0.018,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0095,
    bio: 'Broad US large-cap index tracking 500 leading publicly traded companies across all sectors.',
    waypoints: [
      ['1980-01-02', 105.76], ['1982-08-12', 102.42], ['1985-01-02', 165.37],
      ['1987-08-25', 336.77], ['1987-10-19', 224.84], ['1990-01-02', 359.69],
      ['1995-01-03', 459.11], ['1998-07-17', 1186.75], ['2000-03-24', 1527.46],
      ['2002-10-09', 776.76], ['2007-10-09', 1565.15], ['2008-09-15', 1192.70],
      ['2009-03-09', 676.53], ['2015-01-02', 2058.20], ['2020-02-19', 3386.15],
      ['2020-03-23', 2237.40], ['2021-12-31', 4766.18], ['2022-10-12', 3577.03],
      ['2024-12-31', 5881.63], ['2026-10-23', 6420.00]
    ]
  },
  {
    symbol: 'GLD', name: 'Gold Bullion Spot (oz)', sector: 'Macro', divYield: 0.000,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0110,
    bio: 'Physical Gold Bullion spot tracker ($/oz). Peaked in Jan 1980 inflation shock, slumbered for 20 years, then surged in the 2000s and 2020s.',
    waypoints: [
      ['1980-01-02', 559.00], ['1980-01-21', 850.00], ['1982-06-21', 296.00],
      ['1987-12-01', 486.00], ['1999-08-25', 252.80], ['2008-03-17', 1011.00],
      ['2011-09-05', 1900.00], ['2015-12-17', 1050.00], ['2020-08-06', 2067.00],
      ['2024-10-30', 2780.00], ['2026-10-23', 2940.00]
    ]
  },
  {
    symbol: 'BTC', name: 'Bitcoin (BTC)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2011-01-03', delistDate: null, volatility: 0.0360,
    bio: 'Unlocks Jan 3, 2011 at $0.30! Decentralized digital asset with historic 4-year halving booms and 80% crypto winters.',
    waypoints: [
      ['2011-01-03', 0.30], ['2011-06-08', 29.60], ['2011-11-18', 2.10],
      ['2013-11-29', 1130.00], ['2015-01-14', 178.00], ['2017-12-18', 19400.00],
      ['2018-12-14', 3250.00], ['2021-11-10', 68789.00], ['2022-11-21', 15780.00],
      ['2024-12-05', 98500.00], ['2026-10-23', 112000.00]
    ]
  },

  // --- TECH / SEMICONDUCTORS / AI ---
  {
    symbol: 'IBM', name: 'Intl. Business Machines', sector: 'Tech', divYield: 0.028,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0135,
    bio: '1980s computing titan; launched the IBM PC in 1981, survived a 1993 mainframe crisis, and pivoted to hybrid cloud & AI.',
    waypoints: [
      ['1980-01-02', 16.10], ['1983-12-30', 30.50], ['1987-08-20', 43.20],
      ['1987-10-19', 31.00], ['1993-08-16', 10.40], ['1999-07-15', 126.00],
      ['2002-10-09', 58.00], ['2008-11-20', 74.00], ['2013-03-15', 205.00],
      ['2020-03-23', 95.00], ['2026-10-23', 234.00]
    ]
  },
  {
    symbol: 'INTC', name: 'Intel Corp.', sector: 'Tech', divYield: 0.015,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0185,
    bio: 'Dominated the 1990s PC boom with "Intel Inside" x86 processors before facing mobile & AI chip competition in the 2020s.',
    waypoints: [
      ['1980-01-02', 0.32], ['1987-08-25', 1.10], ['1991-01-02', 1.65],
      ['1995-08-24', 8.90], ['2000-08-31', 74.87], ['2002-10-09', 13.90],
      ['2009-02-23', 12.15], ['2020-01-24', 68.40], ['2024-08-05', 19.80],
      ['2026-10-23', 26.50]
    ]
  },
  {
    symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Tech', divYield: 0.000,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0235,
    bio: 'Longtime x86 rival to Intel; fell to $1.80 in 2015 before CEO Lisa Su engineered a legendary EPYC & AI GPU turnaround.',
    waypoints: [
      ['1980-01-02', 3.10], ['1986-01-02', 14.50], ['1991-01-02', 4.80],
      ['2000-06-01', 47.50], ['2002-10-09', 3.60], ['2006-03-01', 41.80],
      ['2008-11-20', 1.85], ['2015-07-27', 1.62], ['2021-11-29', 161.90],
      ['2022-10-14', 55.90], ['2026-10-23', 168.00]
    ]
  },
  {
    symbol: 'AAPL', name: 'Apple Inc.', sector: 'Tech', divYield: 0.006,
    ipoDate: '1980-12-12', delistDate: null, volatility: 0.0185,
    bio: 'IPO Dec 12, 1980. Nearly went bankrupt in 1997 before Steve Jobs returned, launching the iPod (2001) and iPhone (2007).',
    waypoints: [
      ['1980-12-12', 0.50], ['1983-06-01', 0.92], ['1985-06-01', 0.30],
      ['1987-10-19', 0.78], ['1991-04-01', 1.45], ['1997-07-01', 0.23],
      ['2000-03-20', 1.12], ['2003-04-01', 0.26], ['2007-12-31', 6.10],
      ['2009-03-09', 2.95], ['2015-06-01', 29.50], ['2020-03-23', 56.00],
      ['2022-01-03', 180.00], ['2026-10-23', 248.00]
    ]
  },
  {
    symbol: 'ORCL', name: 'Oracle Corp.', sector: 'Tech', divYield: 0.011,
    ipoDate: '1986-03-12', delistDate: null, volatility: 0.0185,
    bio: 'IPO Mar 12, 1986 (one day before Microsoft!). Larry Ellison’s relational database & cloud AI infrastructure giant.',
    waypoints: [
      ['1986-03-12', 0.09], ['1990-11-01', 0.14], ['1995-12-01', 2.40],
      ['2000-09-01', 45.00], ['2002-10-09', 8.20], ['2010-12-31', 31.30],
      ['2020-03-23', 44.00], ['2026-10-23', 182.00]
    ]
  },
  {
    symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Tech', divYield: 0.008,
    ipoDate: '1986-03-13', delistDate: null, volatility: 0.0165,
    bio: 'IPO Mar 13, 1986. Powered the PC boom with MS-DOS and Windows 95, endured a flat 2000s decade, and soared on Azure Cloud & AI.',
    waypoints: [
      ['1986-03-13', 0.35], ['1987-10-19', 0.65], ['1990-06-01', 1.90],
      ['1995-08-24', 6.20], ['1999-12-30', 58.70], ['2002-10-09', 22.10],
      ['2009-03-09', 15.20], ['2014-02-04', 36.50], ['2020-02-19', 187.00],
      ['2020-03-23', 136.00], ['2021-11-19', 343.00], ['2026-10-23', 446.00]
    ]
  },
  {
    symbol: 'CSCO', name: 'Cisco Systems', sector: 'Tech', divYield: 0.015,
    ipoDate: '1990-02-16', delistDate: null, volatility: 0.0205,
    bio: 'IPO Feb 16, 1990. Built the routers of the 1990s internet boom, rising over 400x in 10 years before crashing 88% in 2000–2002.',
    waypoints: [
      ['1990-02-16', 0.18], ['1994-01-03', 2.10], ['1997-01-02', 11.50],
      ['1999-01-04', 32.00], ['2000-03-27', 80.06], ['2002-10-08', 8.60],
      ['2007-11-01', 33.00], ['2009-03-09', 14.20], ['2020-03-23', 35.50],
      ['2026-10-23', 58.00]
    ]
  },
  {
    symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Tech', divYield: 0.018,
    ipoDate: '1991-12-13', delistDate: null, volatility: 0.0210,
    bio: 'IPO Dec 13, 1991. Wireless CDMA & 5G mobile chip pioneer; famous for soaring 2,619% in the single year of 1999!',
    waypoints: [
      ['1991-12-13', 0.52], ['1998-12-31', 3.40], ['1999-12-30', 88.00],
      ['2002-08-01', 14.20], ['2008-11-20', 31.00], ['2019-04-01', 56.00],
      ['2022-01-04', 188.00], ['2026-10-23', 174.00]
    ]
  },
  {
    symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Tech', divYield: 0.000,
    ipoDate: '1997-05-15', delistDate: null, volatility: 0.0225,
    bio: 'IPO May 15, 1997. Survived a brutal 94% dot-com crash in 2000–2001 to dominate global e-commerce and cloud infrastructure (AWS).',
    waypoints: [
      ['1997-05-15', 0.10], ['1999-12-10', 5.32], ['2001-09-28', 0.30],
      ['2007-10-20', 4.85], ['2009-03-09', 3.05], ['2015-12-31', 33.79],
      ['2020-09-02', 176.50], ['2022-12-28', 81.82], ['2026-10-23', 216.00]
    ]
  },
  {
    symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Tech', divYield: 0.001,
    ipoDate: '1999-01-22', delistDate: null, volatility: 0.0240,
    bio: 'IPO Jan 22, 1999. Invented the GPU in 1999; endured wild 80% drawdowns in 2002 and 2008 before powering the global AI revolution.',
    waypoints: [
      ['1999-01-22', 0.04], ['2002-01-03', 0.56], ['2002-10-09', 0.08],
      ['2007-10-15', 0.92], ['2008-11-20', 0.15], ['2016-01-04', 0.80],
      ['2018-10-01', 7.10], ['2020-03-23', 5.15], ['2021-11-19', 32.90],
      ['2022-10-14', 11.20], ['2024-06-18', 135.58], ['2026-10-23', 152.00]
    ]
  },
  {
    symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Tech', divYield: 0.005,
    ipoDate: '2004-06-23', delistDate: null, volatility: 0.0195,
    bio: 'IPO Jun 23, 2004. Marc Benioff’s "No Software" cloud CRM pioneer that led the enterprise SaaS revolution.',
    waypoints: [
      ['2004-06-23', 3.80], ['2008-11-20', 5.40], ['2015-12-31', 78.40],
      ['2020-09-01', 281.00], ['2022-12-20', 128.00], ['2026-10-23', 312.00]
    ]
  },
  {
    symbol: 'GOOG', name: 'Alphabet Inc. (Google)', sector: 'Tech', divYield: 0.004,
    ipoDate: '2004-08-19', delistDate: null, volatility: 0.0170,
    bio: 'IPO Aug 19, 2004 at $85 ($2.13 split-adjusted). Search, YouTube, Android, Waymo, and Gemini AI powerhouse.',
    waypoints: [
      ['2004-08-19', 2.13], ['2007-11-06', 18.50], ['2008-11-21', 6.50],
      ['2015-12-31', 37.90], ['2020-03-23', 52.80], ['2021-11-18', 150.00],
      ['2022-11-03', 83.50], ['2026-10-23', 194.00]
    ]
  },
  {
    symbol: 'META', name: 'Meta Platforms (Facebook)', sector: 'Tech', divYield: 0.004,
    ipoDate: '2012-05-18', delistDate: null, volatility: 0.0215,
    bio: 'IPO May 18, 2012 at $38. Acquired Instagram & WhatsApp, plunged 75% to $89 in late 2022, then rocketed past $600 on AI.',
    waypoints: [
      ['2012-05-18', 38.00], ['2012-09-04', 17.73], ['2018-07-25', 217.50],
      ['2021-09-07', 382.18], ['2022-11-03', 88.91], ['2024-10-01', 576.00],
      ['2026-10-23', 635.00]
    ]
  },
  {
    symbol: 'SHOP', name: 'Shopify Inc.', sector: 'Tech', divYield: 0.000,
    ipoDate: '2015-05-21', delistDate: null, volatility: 0.0245,
    bio: 'IPO May 21, 2015 at $1.70 split-adjusted. Powered millions of online merchants, surging 100x to its 2021 peak.',
    waypoints: [
      ['2015-05-21', 1.70], ['2019-12-31', 39.70], ['2021-11-19', 169.00],
      ['2022-10-14', 25.60], ['2026-10-23', 108.00]
    ]
  },
  {
    symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Tech', divYield: 0.000,
    ipoDate: '2020-09-30', delistDate: null, volatility: 0.0265,
    bio: 'Direct Listing Sep 30, 2020 at $10. Defense & enterprise AI ontology platform that surged in the 2024–2026 AI wave.',
    waypoints: [
      ['2020-09-30', 9.50], ['2021-01-27', 39.00], ['2022-12-28', 6.00],
      ['2024-11-15', 61.00], ['2026-10-23', 78.00]
    ]
  },

  // --- RETAIL / CONSUMER / MEDIA ---
  {
    symbol: 'WMT', name: 'Walmart Inc.', sector: 'Retail', divYield: 0.015,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0125,
    bio: 'Sam Walton turned a regional discount chain into the world’s largest retailer, compounding 100x+ across the 1980s and 1990s.',
    waypoints: [
      ['1980-01-02', 0.18], ['1985-01-02', 0.85], ['1987-10-19', 1.65],
      ['1992-12-31', 5.30], ['1999-12-31', 22.80], ['2008-12-31', 18.60],
      ['2015-12-31', 20.40], ['2020-12-31', 48.00], ['2026-10-23', 84.50]
    ]
  },
  {
    symbol: 'HD', name: 'The Home Depot', sector: 'Retail', divYield: 0.022,
    ipoDate: '1981-09-22', delistDate: null, volatility: 0.0150,
    bio: 'IPO Sep 22, 1981. Revolutionized big-box home improvement, compounding over 6,000x from its 1981 debut.',
    waypoints: [
      ['1981-09-22', 0.06], ['1987-10-19', 0.38], ['1992-12-31', 4.80],
      ['1999-12-31', 65.50], ['2003-03-01', 21.40], ['2009-03-09', 18.90],
      ['2015-12-31', 132.00], ['2021-12-31', 415.00], ['2026-10-23', 408.00]
    ]
  },
  {
    symbol: 'COST', name: 'Costco Wholesale', sector: 'Retail', divYield: 0.008,
    ipoDate: '1985-12-05', delistDate: null, volatility: 0.0135,
    bio: 'IPO Dec 5, 1985. Membership warehouse club beloved for $1.50 hot dogs, Kirkland Signature, and relentless compounding.',
    waypoints: [
      ['1985-12-05', 1.10], ['1992-12-01', 7.50], ['1999-12-31', 44.00],
      ['2002-10-09', 28.00], ['2009-03-09', 38.50], ['2019-12-31', 293.00],
      ['2024-10-01', 895.00], ['2026-10-23', 960.00]
    ]
  },
  {
    symbol: 'GME', name: 'GameStop Corp.', sector: 'Retail', divYield: 0.000,
    ipoDate: '2002-02-13', delistDate: null, volatility: 0.0285,
    bio: 'IPO Feb 13, 2002. Mall video-game retailer that fell to $1.00 in 2020 before exploding 80x in the Jan 2021 Reddit short squeeze!',
    waypoints: [
      ['2002-02-13', 2.40], ['2007-12-20', 15.50], ['2013-11-15', 13.80],
      ['2019-08-15', 0.85], ['2020-08-31', 1.65], ['2021-01-28', 81.25],
      ['2023-12-31', 17.50], ['2024-05-14', 48.75], ['2026-10-23', 24.50]
    ]
  },
  {
    symbol: 'KO', name: 'The Coca-Cola Co.', sector: 'Consumer', divYield: 0.030,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0110,
    bio: 'Global beverage icon and Dividend King. Warren Buffett bought heavily after the 1987 crash as global expansion soared.',
    waypoints: [
      ['1980-01-02', 0.72], ['1985-06-01', 1.48], ['1987-10-19', 2.15],
      ['1992-06-01', 10.20], ['1998-07-15', 43.50], ['2003-03-01', 20.10],
      ['2009-03-09', 19.80], ['2019-12-31', 55.30], ['2026-10-23', 71.20]
    ]
  },
  {
    symbol: 'MCD', name: 'McDonald’s Corp.', sector: 'Consumer', divYield: 0.024,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0115,
    bio: 'Recession-resilient global restaurant & real estate empire that raised its dividend every single year from 1980 to 2026.',
    waypoints: [
      ['1980-01-02', 0.95], ['1987-10-19', 2.80], ['1995-12-29', 11.20],
      ['1999-11-01', 24.50], ['2003-03-12', 7.80], ['2008-12-31', 39.50],
      ['2015-12-31', 96.00], ['2020-03-23', 138.00], ['2026-10-23', 312.00]
    ]
  },
  {
    symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer', divYield: 0.026,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0105,
    bio: 'Household consumer staples fortress (Tide, Pampers, Gillette) with 68+ consecutive years of dividend increases.',
    waypoints: [
      ['1980-01-02', 1.15], ['1990-01-02', 4.30], ['2000-01-03', 26.80],
      ['2009-03-09', 36.20], ['2019-12-31', 115.00], ['2026-10-23', 174.00]
    ]
  },
  {
    symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer', divYield: 0.014,
    ipoDate: '1980-12-02', delistDate: null, volatility: 0.0155,
    bio: 'IPO Dec 2, 1980. Signed Michael Jordan in 1984 and turned athletic footwear into a global cultural powerhouse.',
    waypoints: [
      ['1980-12-02', 0.18], ['1985-06-01', 0.25], ['1990-06-01', 1.35],
      ['1997-02-01', 9.20], ['2000-03-01', 3.80], ['2008-03-01', 16.50],
      ['2015-11-01', 66.00], ['2021-11-05', 177.50], ['2026-10-23', 89.00]
    ]
  },
  {
    symbol: 'SBUX', name: 'Starbucks Corp.', sector: 'Consumer', divYield: 0.018,
    ipoDate: '1992-06-26', delistDate: null, volatility: 0.0175,
    bio: 'IPO Jun 26, 1992. Howard Schultz scaled Seattle specialty coffee from 165 stores at IPO to over 38,000 cafes worldwide.',
    waypoints: [
      ['1992-06-26', 0.34], ['1999-12-31', 3.10], ['2006-05-01', 18.80],
      ['2008-11-20', 3.90], ['2015-10-30', 61.50], ['2021-07-23', 125.00],
      ['2026-10-23', 98.50]
    ]
  },
  {
    symbol: 'DIS', name: 'The Walt Disney Co.', sector: 'Consumer', divYield: 0.010,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0145,
    bio: '1990s Animation Renaissance (Lion King), Pixar & Marvel acquisitions, theme park empire, and 2020s streaming wars.',
    waypoints: [
      ['1980-01-02', 0.85], ['1987-08-25', 5.20], ['1994-12-30', 15.10],
      ['2000-05-01', 41.50], ['2002-08-01', 14.20], ['2009-03-09', 16.00],
      ['2015-08-01', 118.00], ['2021-03-08', 197.00], ['2026-10-23', 108.00]
    ]
  },
  {
    symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Consumer', divYield: 0.000,
    ipoDate: '2002-05-23', delistDate: null, volatility: 0.0230,
    bio: 'IPO May 23, 2002. Disrupted Blockbuster with no-late-fee DVDs by mail, pivoted to streaming in 2007, and became a global titan.',
    waypoints: [
      ['2002-05-23', 1.15], ['2007-01-03', 3.20], ['2011-07-13', 42.60],
      ['2012-09-25', 7.80], ['2018-06-20', 411.00], ['2021-11-17', 691.69],
      ['2022-05-11', 166.37], ['2026-10-23', 765.00]
    ]
  },
  {
    symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer', divYield: 0.000,
    ipoDate: '2010-06-29', delistDate: null, volatility: 0.0255,
    bio: 'IPO Jun 29, 2010. Electric vehicle and energy pioneer that squeezed short sellers with a historic 20x breakout in 2020–2021.',
    waypoints: [
      ['2010-06-29', 1.59], ['2013-09-30', 12.80], ['2019-06-03', 11.93],
      ['2020-02-19', 61.16], ['2020-03-18', 24.08], ['2021-11-04', 409.97],
      ['2023-01-06', 108.10], ['2026-10-23', 268.00]
    ]
  },

  // --- FINANCE ---
  {
    symbol: 'BRK', name: 'Berkshire Hathaway', sector: 'Finance', divYield: 0.000,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0105,
    bio: 'Warren Buffett and Charlie Munger’s Omaha compounding machine—famous for disciplined value investing and massive cash reserves.',
    waypoints: [
      ['1980-01-02', 3.20], ['1985-01-02', 12.80], ['1989-12-29', 58.00],
      ['1998-06-01', 156.00], ['2000-03-10', 92.00], ['2007-12-10', 298.00],
      ['2009-03-09', 152.00], ['2019-12-31', 339.00], ['2026-10-23', 468.00]
    ]
  },
  {
    symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Finance', divYield: 0.026,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0155,
    bio: 'Wall Street banking fortress; acquired Bear Stearns and WaMu during the 2008 crisis under Jamie Dimon.',
    waypoints: [
      ['1980-01-02', 4.10], ['1987-10-19', 9.20], ['1995-01-03', 15.80],
      ['2000-03-24', 56.00], ['2002-10-09', 16.50], ['2007-05-01', 51.00],
      ['2009-03-09', 15.90], ['2019-12-31', 138.00], ['2026-10-23', 238.00]
    ]
  },
  {
    symbol: 'GS', name: 'Goldman Sachs Group', sector: 'Finance', divYield: 0.020,
    ipoDate: '1999-05-04', delistDate: null, volatility: 0.0175,
    bio: 'IPO May 4, 1999. Wall Street’s premier M&A and trading powerhouse; navigated 2008 by converting into a bank holding company.',
    waypoints: [
      ['1999-05-04', 53.00], ['2000-09-01', 118.00], ['2002-10-09', 58.00],
      ['2007-10-31', 247.00], ['2008-11-20', 52.00], ['2019-12-31', 229.00],
      ['2026-10-23', 535.00]
    ]
  },
  {
    symbol: 'V', name: 'Visa Inc.', sector: 'Finance', divYield: 0.008,
    ipoDate: '2008-03-19', delistDate: null, volatility: 0.0135,
    bio: 'IPO Mar 19, 2008 (right in the middle of the Bear Stearns crisis!). Global digital payments network that compounded 20x.',
    waypoints: [
      ['2008-03-19', 14.10], ['2009-03-09', 11.20], ['2015-12-31', 77.50],
      ['2020-02-19', 213.00], ['2026-10-23', 298.00]
    ]
  },

  // --- HEALTHCARE ---
  {
    symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', divYield: 0.030,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0105,
    bio: 'AAA-rated healthcare & medical device Dividend King; famous for its gold-standard 1982 Tylenol recall response.',
    waypoints: [
      ['1980-01-02', 0.95], ['1990-01-02', 3.70], ['2000-01-03', 29.50],
      ['2009-03-09', 36.80], ['2019-12-31', 145.00], ['2026-10-23', 166.00]
    ]
  },
  {
    symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', divYield: 0.035,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0135,
    bio: '1990s pharmaceutical juggernaut behind Lipitor, surging 20x in the 90s and peaking again during the 2021 vaccine rollout.',
    waypoints: [
      ['1980-01-02', 0.45], ['1990-01-02', 1.85], ['1999-04-15', 38.50],
      ['2009-03-09', 11.60], ['2015-12-31', 30.20], ['2021-12-17', 59.40],
      ['2026-10-23', 29.80]
    ]
  },
  {
    symbol: 'LLY', name: 'Eli Lilly & Co.', sector: 'Healthcare', divYield: 0.012,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0150,
    bio: '100-year pharma giant; rode the 1990s Prozac boom, then became the world’s most valuable healthcare company on 2020s GLP-1 breakthroughs.',
    waypoints: [
      ['1980-01-02', 1.10], ['1990-01-02', 6.50], ['2000-08-01', 78.00],
      ['2009-03-09', 22.80], ['2019-12-31', 131.00], ['2024-08-20', 950.00],
      ['2026-10-23', 985.00]
    ]
  },
  {
    symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', divYield: 0.014,
    ipoDate: '1984-10-17', delistDate: null, volatility: 0.0155,
    bio: 'IPO Oct 17, 1984 at $0.08 split-adjusted. Quietly compounded over 6,500x across four decades of US healthcare expansion.',
    waypoints: [
      ['1984-10-17', 0.08], ['1995-01-03', 3.60], ['2005-12-30', 58.00],
      ['2009-03-09', 16.50], ['2019-12-31', 293.00], ['2026-10-23', 575.00]
    ]
  },

  // --- ENERGY / INDUSTRIAL / DEFENSE ---
  {
    symbol: 'XOM', name: 'ExxonMobil Corp.', sector: 'Industrial', divYield: 0.036,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0125,
    bio: 'Global energy supermajor with high dividend yield; thrives in inflation and oil booms, tested during 1986 and 2020 oil gluts.',
    waypoints: [
      ['1980-01-02', 3.40], ['1986-04-01', 6.80], ['1990-10-01', 12.90],
      ['2000-01-03', 39.50], ['2008-05-20', 93.00], ['2009-03-09', 62.00],
      ['2014-06-20', 102.00], ['2020-03-23', 31.50], ['2022-11-01', 111.00],
      ['2026-10-23', 123.00]
    ]
  },
  {
    symbol: 'GE', name: 'General Electric', sector: 'Industrial', divYield: 0.022,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0145,
    bio: 'Jack Welch made GE the most valuable company in the world by 2000, before GE Capital losses in 2008 and 2018 nearly sank it.',
    waypoints: [
      ['1980-01-02', 4.20], ['1987-08-25', 22.00], ['1987-10-19', 15.10],
      ['1995-01-03', 42.00], ['2000-08-28', 285.00], ['2003-02-20', 115.00],
      ['2007-10-01', 198.00], ['2009-03-05', 38.00], ['2016-07-15', 152.00],
      ['2018-12-10', 36.50], ['2026-10-23', 189.00]
    ]
  },
  {
    symbol: 'BA', name: 'The Boeing Company', sector: 'Industrial', divYield: 0.016,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0165,
    bio: 'Commercial jetliner & aerospace leader; soared to $440 in early 2019 before 737 MAX groundings and supply chain woes.',
    waypoints: [
      ['1980-01-02', 3.80], ['1990-06-01', 26.50], ['2007-07-01', 98.00],
      ['2009-03-09', 29.50], ['2019-03-01', 440.60], ['2020-03-20', 95.00],
      ['2026-10-23', 162.00]
    ]
  },
  {
    symbol: 'LMT', name: 'Lockheed Martin', sector: 'Industrial', divYield: 0.028,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0130,
    bio: 'Premier defense & aerospace prime contractor (Skunk Works, F-35); resilient outperformer during geopolitical tensions.',
    waypoints: [
      ['1980-01-02', 2.40], ['1989-12-29', 9.80], ['1999-12-31', 19.50],
      ['2008-09-01', 98.00], ['2019-12-31', 389.00], ['2026-10-23', 585.00]
    ]
  },
  {
    symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrial', divYield: 0.022,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0155,
    bio: 'Global heavy-machinery, mining, and data-center backup power giant; rides global infrastructure and commodity supercycles.',
    waypoints: [
      ['1980-01-02', 3.10], ['1995-01-03', 11.40], ['2007-10-01', 78.00],
      ['2009-03-09', 22.50], ['2011-05-01', 112.00], ['2020-03-23', 92.00],
      ['2026-10-23', 392.00]
    ]
  },

  // --- 7 FAMOUS HISTORICAL BANKRUPTCIES & SHORT-SELLING TARGETS ---
  {
    symbol: 'PNAA', name: 'Pan Am Airways', sector: 'Industrial', divYield: 0.000,
    ipoDate: '1980-01-02', delistDate: '1991-12-04', volatility: 0.0220,
    bio: 'BANKRUPTCY TARGET: Iconic airline crushed by deregulation and the 1990 Gulf War fuel spike, filing bankruptcy Dec 4, 1991.',
    waypoints: [
      ['1980-01-02', 18.50], ['1983-06-01', 24.80], ['1986-06-01', 16.20],
      ['1987-10-19', 9.40], ['1989-01-03', 6.80], ['1990-10-01', 2.40],
      ['1991-11-15', 0.45], ['1991-12-04', 0.00]
    ]
  },
  {
    symbol: 'IPET', name: 'Pets.com Inc.', sector: 'Retail', divYield: 0.000,
    ipoDate: '2000-02-11', delistDate: '2000-11-07', volatility: 0.0320,
    bio: 'DOT-COM SHORT TARGET: Went public Feb 11, 2000 at $11 selling pet food below shipping cost; liquidated Nov 7, 2000 in 268 days!',
    waypoints: [
      ['2000-02-11', 11.00], ['2000-02-18', 14.00], ['2000-04-15', 3.50],
      ['2000-08-01', 1.25], ['2000-11-01', 0.22], ['2000-11-07', 0.00]
    ]
  },
  {
    symbol: 'ENE', name: 'Enron Corp.', sector: 'Industrial', divYield: 0.012,
    ipoDate: '1980-01-02', delistDate: '2001-12-02', volatility: 0.0195,
    bio: 'FRAUD SHORT TARGET: Soared to $90 in Aug 2000 as "America’s Most Innovative Company" before accounting fraud caused its Dec 2001 collapse.',
    waypoints: [
      ['1980-01-02', 7.50], ['1987-01-02', 11.20], ['1993-01-04', 24.00],
      ['1998-01-02', 41.50], ['2000-08-23', 90.56], ['2001-02-01', 79.00],
      ['2001-08-15', 42.00], ['2001-10-25', 15.40], ['2001-11-28', 0.61],
      ['2001-12-02', 0.00]
    ]
  },
  {
    symbol: 'WCOM', name: 'WorldCom Inc.', sector: 'Tech', divYield: 0.000,
    ipoDate: '1989-10-03', delistDate: '2002-07-21', volatility: 0.0220,
    bio: 'FRAUD SHORT TARGET: 1990s telecom roll-up darling that peaked at $64 in 1999 before an $11B accounting scandal wiped it out in July 2002.',
    waypoints: [
      ['1989-10-03', 1.40], ['1995-01-03', 8.50], ['1999-06-21', 64.50],
      ['2000-12-29', 14.00], ['2002-04-01', 4.20], ['2002-06-25', 0.83],
      ['2002-07-21', 0.00]
    ]
  },
  {
    symbol: 'LEH', name: 'Lehman Brothers', sector: 'Finance', divYield: 0.014,
    ipoDate: '1994-05-03', delistDate: '2008-09-15', volatility: 0.0215,
    bio: 'SUBPRIME SHORT TARGET: Spun off in May 1994, Lehman rode the 2000s mortgage boom to $85 before collapsing Sep 15, 2008.',
    waypoints: [
      ['1994-05-03', 4.50], ['1998-07-01', 19.50], ['1998-10-05', 7.20],
      ['2000-09-01', 36.00], ['2005-06-01', 62.00], ['2007-02-07', 85.80],
      ['2008-03-17', 31.75], ['2008-09-09', 7.79], ['2008-09-12', 3.65],
      ['2008-09-15', 0.00]
    ]
  },
  {
    symbol: 'BBI', name: 'Blockbuster Video', sector: 'Retail', divYield: 0.000,
    ipoDate: '1985-05-15', delistDate: '2010-09-23', volatility: 0.0225,
    bio: 'DISRUPTION SHORT TARGET: Expanded to 9,000+ video stores in the 1990s, passed on buying Netflix for $50M, and filed bankruptcy Sep 23, 2010.',
    waypoints: [
      ['1985-05-15', 1.20], ['1989-06-01', 8.50], ['1994-06-01', 24.00],
      ['1999-08-01', 18.00], ['2002-05-01', 29.10], ['2005-06-01', 9.20],
      ['2007-06-01', 4.30], ['2009-06-01', 0.75], ['2010-09-23', 0.00]
    ]
  },
  {
    symbol: 'KODK', name: 'Eastman Kodak Co.', sector: 'Consumer', divYield: 0.025,
    ipoDate: '1980-01-02', delistDate: '2012-01-19', volatility: 0.0175,
    bio: 'DISRUPTION SHORT TARGET: Dow 30 photography giant that peaked at $94 in 1997 but failed to transition from film to smartphones, filing Chapter 11 Jan 19, 2012.',
    waypoints: [
      ['1980-01-02', 28.00], ['1987-08-25', 65.00], ['1997-02-15', 94.00],
      ['2000-09-01', 59.00], ['2004-01-02', 27.00], ['2007-06-01', 26.50],
      ['2009-03-09', 2.50], ['2011-12-01', 0.65], ['2012-01-19', 0.00]
    ]
  },

  // --- 35 ADDITIONAL ICONIC ASSETS (EXPANDING ROSTER TO 85) ---
  {
    symbol: 'QQQ', name: 'NASDAQ-100 Tech Index', sector: 'Macro', divYield: 0.006,
    ipoDate: '1999-03-10', delistDate: null, volatility: 0.0155,
    bio: 'IPO Mar 10, 1999. Tracks the 100 largest non-financial companies on NASDAQ; crashed 82% in 2000–2002 before compounding 25x.',
    waypoints: [
      ['1999-03-10', 51.00], ['2000-03-24', 118.50], ['2002-10-09', 20.10],
      ['2007-10-31', 54.80], ['2009-03-09', 25.70], ['2020-02-19', 236.00],
      ['2021-11-19', 403.00], ['2022-12-28', 260.00], ['2026-10-23', 538.00]
    ]
  },
  {
    symbol: 'USO', name: 'WTI Crude Oil Spot (bbl)', sector: 'Macro', divYield: 0.000,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0195,
    bio: 'West Texas Intermediate Crude Oil ($/barrel). Spiked to $145 in July 2008, plunged in the 1986, 2015, and 2020 oil gluts.',
    waypoints: [
      ['1980-01-02', 37.00], ['1986-03-31', 10.40], ['1990-10-11', 40.40],
      ['1998-12-10', 10.80], ['2008-07-03', 145.29], ['2009-02-18', 34.60],
      ['2014-06-20', 107.00], ['2016-02-11', 26.20], ['2020-04-21', 11.50],
      ['2022-03-08', 123.70], ['2026-10-23', 74.50]
    ]
  },
  {
    symbol: 'ETH', name: 'Ethereum (ETH)', sector: 'Crypto', divYield: 0.025,
    ipoDate: '2015-08-07', delistDate: null, volatility: 0.0380,
    bio: 'Unlocks Aug 7, 2015 at $2.80! Programmable smart-contract blockchain behind DeFi, NFTs, and tokenized assets (2.5% staking yield).',
    waypoints: [
      ['2015-08-07', 2.80], ['2016-06-16', 20.50], ['2018-01-12', 1390.00],
      ['2018-12-14', 84.00], ['2021-11-10', 4815.00], ['2022-06-18', 995.00],
      ['2024-03-11', 4060.00], ['2026-10-23', 3850.00]
    ]
  },
  {
    symbol: 'TXN', name: 'Texas Instruments', sector: 'Tech', divYield: 0.026,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0155,
    bio: 'Analog & embedded semiconductor leader; famous for 1980s graphing calculators, DSP chips, and massive free-cash-flow dividends.',
    waypoints: [
      ['1980-01-02', 0.92], ['1990-01-02', 1.50], ['2000-03-03', 84.00],
      ['2002-10-09', 13.50], ['2009-03-09', 14.20], ['2019-12-31', 128.00],
      ['2026-10-23', 212.00]
    ]
  },
  {
    symbol: 'MU', name: 'Micron Technology', sector: 'Tech', divYield: 0.005,
    ipoDate: '1984-06-01', delistDate: null, volatility: 0.0250,
    bio: 'IPO Jun 1, 1984. US memory & High-Bandwidth Memory (HBM) chipmaker known for wild boom-bust DRAM cycles and 2024–26 AI surge.',
    waypoints: [
      ['1984-06-01', 0.28], ['1995-09-11', 18.90], ['1998-08-31', 5.60],
      ['2000-07-14', 96.50], ['2002-10-09', 11.80], ['2008-11-20', 1.69],
      ['2018-05-29', 61.40], ['2024-06-18', 153.00], ['2026-10-23', 138.00]
    ]
  },
  {
    symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Tech', divYield: 0.000,
    ipoDate: '1986-08-20', delistDate: null, volatility: 0.0190,
    bio: 'IPO Aug 20, 1986 at $0.17 split-adjusted. Created PostScript, PDF, Photoshop, and pioneered the Creative Cloud subscription shift.',
    waypoints: [
      ['1986-08-20', 0.17], ['1995-01-03', 1.85], ['2000-09-01', 38.00],
      ['2002-08-01', 8.50], ['2009-03-09', 16.20], ['2018-09-14', 275.00],
      ['2021-11-19', 688.00], ['2022-09-30', 275.00], ['2026-10-23', 525.00]
    ]
  },
  {
    symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Tech', divYield: 0.014,
    ipoDate: '2009-08-06', delistDate: null, volatility: 0.0195,
    bio: 'IPO Aug 6, 2009 at $1.60 split-adjusted. Hock Tan’s semiconductor & infrastructure software roll-up giant powering custom AI chips.',
    waypoints: [
      ['2009-08-06', 1.60], ['2015-12-31', 14.50], ['2020-03-18', 16.80],
      ['2021-12-31', 66.50], ['2024-06-18', 180.00], ['2026-10-23', 214.00]
    ]
  },
  {
    symbol: 'NOW', name: 'ServiceNow Inc.', sector: 'Tech', divYield: 0.000,
    ipoDate: '2012-06-29', delistDate: null, volatility: 0.0210,
    bio: 'IPO Jun 29, 2012 at $18. Enterprise cloud workflow automation powerhouse that compounded over 50x in 14 years.',
    waypoints: [
      ['2012-06-29', 18.00], ['2016-02-08', 48.00], ['2019-12-31', 282.00],
      ['2021-11-04', 701.00], ['2022-10-14', 345.00], ['2026-10-23', 980.00]
    ]
  },
  {
    symbol: 'SPOT', name: 'Spotify Technology', sector: 'Tech', divYield: 0.000,
    ipoDate: '2018-04-03', delistDate: null, volatility: 0.0225,
    bio: 'Direct Listing Apr 3, 2018. Global audio, music, podcast, and audiobook streaming leader with 600M+ listeners.',
    waypoints: [
      ['2018-04-03', 149.00], ['2021-02-19', 364.00], ['2022-11-09', 71.50],
      ['2024-10-01', 385.00], ['2026-10-23', 445.00]
    ]
  },
  {
    symbol: 'UBER', name: 'Uber Technologies', sector: 'Tech', divYield: 0.000,
    ipoDate: '2019-05-10', delistDate: null, volatility: 0.0235,
    bio: 'IPO May 10, 2019 at $45. Weathered 2020 pandemic lockdowns to achieve massive free-cash-flow profitability and S&P 500 inclusion.',
    waypoints: [
      ['2019-05-10', 41.50], ['2020-03-18', 14.80], ['2021-02-11', 63.10],
      ['2022-06-30', 20.40], ['2024-10-11', 86.00], ['2026-10-23', 94.00]
    ]
  },
  {
    symbol: 'SNOW', name: 'Snowflake Inc.', sector: 'Tech', divYield: 0.000,
    ipoDate: '2020-09-16', delistDate: null, volatility: 0.0260,
    bio: 'IPO Sep 16, 2020 (backed by Berkshire Hathaway!). Cloud data warehouse platform that debuted above $240.',
    waypoints: [
      ['2020-09-16', 253.00], ['2021-11-16', 401.00], ['2022-06-14', 114.00],
      ['2024-02-28', 230.00], ['2026-10-23', 158.00]
    ]
  },
  {
    symbol: 'ABNB', name: 'Airbnb Inc.', sector: 'Consumer', divYield: 0.000,
    ipoDate: '2020-12-10', delistDate: null, volatility: 0.0225,
    bio: 'IPO Dec 10, 2020. Global home-sharing marketplace that doubled on its opening day as remote work & travel rebounded.',
    waypoints: [
      ['2020-12-10', 144.70], ['2021-02-11', 216.80], ['2022-12-28', 82.50],
      ['2024-03-21', 168.00], ['2026-10-23', 152.00]
    ]
  },
  {
    symbol: 'COIN', name: 'Coinbase Global (Crypto Exch)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2021-04-14', delistDate: null, volatility: 0.0340,
    bio: 'Direct Listing Apr 14, 2021 at $328. Leading US regulated crypto exchange & custodian for Bitcoin/Ethereum ETFs.',
    waypoints: [
      ['2021-04-14', 328.00], ['2021-11-09', 357.00], ['2022-12-28', 32.50],
      ['2024-03-25', 279.00], ['2026-10-23', 265.00]
    ]
  },
  {
    symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer', divYield: 0.031,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0105,
    bio: 'Global beverage and Frito-Lay snack-food empire (Doritos, Lay’s, Gatorade, Pepsi) with 52+ years of dividend growth.',
    waypoints: [
      ['1980-01-02', 0.85], ['1990-01-02', 6.40], ['2000-01-03', 35.20],
      ['2009-03-09', 46.50], ['2019-12-31', 136.00], ['2026-10-23', 178.00]
    ]
  },
  {
    symbol: 'PM', name: 'Altria / Philip Morris', sector: 'Consumer', divYield: 0.068,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0125,
    bio: 'HIGHEST DIVIDEND PAYER (6.8% Yield!): Historic consumer cash cow that spun off Kraft, Mondelez, and Philip Morris International.',
    waypoints: [
      ['1980-01-02', 0.52], ['1990-01-02', 4.80], ['1998-11-20', 18.50],
      ['2000-03-01', 6.90], ['2007-12-31', 23.80], ['2017-06-01', 74.00],
      ['2020-03-23', 31.50], ['2026-10-23', 54.00]
    ]
  },
  {
    symbol: 'MNST', name: 'Monster Beverage', sector: 'Consumer', divYield: 0.000,
    ipoDate: '1995-08-15', delistDate: null, volatility: 0.0215,
    bio: 'IPO Aug 15, 1995 (as Hansen Natural) at $0.01 split-adjusted! Launched Monster Energy in 2002 and compounded over 5,000x!',
    waypoints: [
      ['1995-08-15', 0.01], ['2002-04-01', 0.07], ['2006-07-05', 3.40],
      ['2008-10-27', 1.80], ['2015-12-31', 24.80], ['2026-10-23', 56.00]
    ]
  },
  {
    symbol: 'CMG', name: 'Chipotle Mexican Grill', sector: 'Consumer', divYield: 0.000,
    ipoDate: '2006-01-26', delistDate: null, volatility: 0.0185,
    bio: 'IPO Jan 26, 2006 at $0.44 split-adjusted (50-for-1 split in 2024). Fast-casual burrito chain that compounded over 135x since IPO.',
    waypoints: [
      ['2006-01-26', 0.44], ['2008-11-20', 0.78], ['2015-08-05', 15.10],
      ['2018-02-08', 5.10], ['2021-09-23', 39.00], ['2024-06-18', 68.50],
      ['2026-10-23', 64.00]
    ]
  },
  {
    symbol: 'F', name: 'Ford Motor Company', sector: 'Consumer', divYield: 0.042,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0180,
    bio: 'Iconic Detroit automaker behind the F-150 & Mustang; mortgaged its blue-oval logo in 2006 to survive 2008–2009 without a bailout.',
    waypoints: [
      ['1980-01-02', 1.40], ['1988-01-04', 6.50], ['1999-04-30', 36.80],
      ['2008-11-19', 1.26], ['2011-01-03', 18.20], ['2020-03-23', 4.01],
      ['2022-01-13', 25.19], ['2026-10-23', 11.80]
    ]
  },
  {
    symbol: 'TGT', name: 'Target Corp.', sector: 'Retail', divYield: 0.028,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0145,
    bio: 'Upgraded from Dayton Hudson department stores into America’s favorite upscale-discount retailer and Dividend King.',
    waypoints: [
      ['1980-01-02', 0.48], ['1990-01-02', 2.60], ['2000-01-03', 36.00],
      ['2009-03-09', 25.50], ['2019-12-31', 128.00], ['2021-11-16', 266.00],
      ['2026-10-23', 156.00]
    ]
  },
  {
    symbol: 'LOW', name: 'Lowe’s Companies', sector: 'Retail', divYield: 0.019,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0155,
    bio: 'Home improvement retail compounder and Dividend King; grew from small-town hardware stores to 1,700+ supercenters.',
    waypoints: [
      ['1980-01-02', 0.14], ['1990-01-02', 0.75], ['2000-01-03', 14.80],
      ['2009-03-09', 13.50], ['2019-12-31', 119.00], ['2026-10-23', 274.00]
    ]
  },
  {
    symbol: 'BAC', name: 'Bank of America', sector: 'Finance', divYield: 0.025,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0190,
    bio: 'Nationwide banking giant; bought Countrywide & Merrill Lynch in 2008, plunged to $3.14 in Mar 2009, and recovered with Buffett’s backing.',
    waypoints: [
      ['1980-01-02', 2.40], ['1990-01-02', 6.80], ['2006-11-20', 54.90],
      ['2009-03-06', 3.14], ['2011-12-19', 4.99], ['2019-12-31', 35.20],
      ['2026-10-23', 44.50]
    ]
  },
  {
    symbol: 'AXP', name: 'American Express Co.', sector: 'Finance', divYield: 0.012,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0155,
    bio: 'Premium charge-card & travel network; one of Warren Buffett’s oldest and largest permanent holdings.',
    waypoints: [
      ['1980-01-02', 1.85], ['1990-01-02', 6.90], ['2000-08-01', 59.00],
      ['2009-03-09', 10.26], ['2019-12-31', 124.00], ['2026-10-23', 284.00]
    ]
  },
  {
    symbol: 'MS', name: 'Morgan Stanley', sector: 'Finance', divYield: 0.032,
    ipoDate: '1986-03-21', delistDate: null, volatility: 0.0185,
    bio: 'IPO Mar 21, 1986 (just 8 days after Microsoft!). Premier tech IPO underwriter and global wealth management powerhouse.',
    waypoints: [
      ['1986-03-21', 1.90], ['1995-01-03', 7.40], ['2000-09-01', 91.00],
      ['2008-11-20', 9.20], ['2019-12-31', 51.00], ['2026-10-23', 119.00]
    ]
  },
  {
    symbol: 'MA', name: 'Mastercard Inc.', sector: 'Finance', divYield: 0.006,
    ipoDate: '2006-05-25', delistDate: null, volatility: 0.0145,
    bio: 'IPO May 25, 2006 at $3.90 split-adjusted. High-margin global payment rail that compounded over 125x in 20 years.',
    waypoints: [
      ['2006-05-25', 3.90], ['2008-06-02', 30.20], ['2009-01-20', 12.10],
      ['2015-12-31', 97.00], ['2020-02-19', 344.00], ['2026-10-23', 512.00]
    ]
  },
  {
    symbol: 'MRK', name: 'Merck & Co.', sector: 'Healthcare', divYield: 0.028,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0130,
    bio: 'Voted America’s Most Admired Company 7 years straight in the 1980s–90s; maker of blockbuster cancer immunotherapy Keytruda.',
    waypoints: [
      ['1980-01-02', 1.15], ['1991-12-31', 18.50], ['2000-12-29', 88.00],
      ['2004-09-30', 33.00], ['2009-03-09', 20.90], ['2024-06-01', 131.00],
      ['2026-10-23', 114.00]
    ]
  },
  {
    symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare', divYield: 0.029,
    ipoDate: '1983-06-17', delistDate: null, volatility: 0.0170,
    bio: 'IPO Jun 17, 1983 at $0.38 split-adjusted. Biotechnology pioneer behind Epogen and Neupogen that rose 150x in the 1980s–90s.',
    waypoints: [
      ['1983-06-17', 0.38], ['1991-12-31', 9.40], ['2000-07-14', 74.50],
      ['2008-03-17', 41.00], ['2015-07-31', 176.00], ['2026-10-23', 326.00]
    ]
  },
  {
    symbol: 'GILD', name: 'Gilead Sciences', sector: 'Healthcare', divYield: 0.036,
    ipoDate: '1992-01-22', delistDate: null, volatility: 0.0180,
    bio: 'IPO Jan 22, 1992 at $0.47 split-adjusted. Antiviral leader behind Tamiflu, HIV therapies, and Hepatitis C cure Sovaldi.',
    waypoints: [
      ['1992-01-22', 0.47], ['2000-01-03', 3.50], ['2008-08-01', 27.80],
      ['2015-06-23', 122.00], ['2020-12-31', 58.20], ['2026-10-23', 92.00]
    ]
  },
  {
    symbol: 'ISRG', name: 'Intuitive Surgical', sector: 'Healthcare', divYield: 0.000,
    ipoDate: '2000-06-13', delistDate: null, volatility: 0.0210,
    bio: 'IPO Jun 13, 2000 at $2.00 split-adjusted. Maker of the da Vinci surgical robot system, compounding over 240x!',
    waypoints: [
      ['2000-06-13', 2.00], ['2003-03-12', 0.72], ['2007-12-28', 35.80],
      ['2009-03-09', 9.80], ['2019-12-31', 197.00], ['2026-10-23', 515.00]
    ]
  },
  {
    symbol: 'CVX', name: 'Chevron Corp.', sector: 'Industrial', divYield: 0.038,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0130,
    bio: 'Integrated global energy supermajor and Dividend Aristocrat with a 3.8% yield and strong Permian Basin cash flows.',
    waypoints: [
      ['1980-01-02', 4.20], ['1990-01-02', 8.50], ['2000-01-03', 21.80],
      ['2008-05-20', 103.00], ['2009-03-09', 56.50], ['2020-03-23', 54.20],
      ['2022-11-14', 188.00], ['2026-10-23', 158.00]
    ]
  },
  {
    symbol: 'UNP', name: 'Union Pacific Corp.', sector: 'Industrial', divYield: 0.022,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0135,
    bio: 'Built the first transcontinental railroad under Abraham Lincoln; operates an irreplaceable 32,000-mile freight moat across western America.',
    waypoints: [
      ['1980-01-02', 1.80], ['1990-01-02', 4.50], ['2000-01-03', 10.90],
      ['2008-05-01', 40.50], ['2009-03-09', 17.20], ['2019-12-31', 180.00],
      ['2026-10-23', 246.00]
    ]
  },
  {
    symbol: 'DE', name: 'Deere & Co. (John Deere)', sector: 'Industrial', divYield: 0.015,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0155,
    bio: 'Iconic green-and-yellow agricultural & construction machinery giant leading autonomous precision farming.',
    waypoints: [
      ['1980-01-02', 1.95], ['1990-01-02', 4.10], ['2000-01-03', 14.50],
      ['2008-04-14', 93.00], ['2009-03-09', 24.80], ['2019-12-31', 173.00],
      ['2022-04-18', 436.00], ['2026-10-23', 415.00]
    ]
  },
  {
    symbol: 'T', name: 'AT&T Inc.', sector: 'Tech', divYield: 0.052,
    ipoDate: '1980-01-02', delistDate: null, volatility: 0.0120,
    bio: '"Ma Bell" telecommunications & 5G fiber giant paying a hefty 5.2% dividend yield across decades of industry consolidation.',
    waypoints: [
      ['1980-01-02', 3.50], ['1990-01-02', 7.80], ['1999-11-01', 29.50],
      ['2003-03-11', 9.80], ['2007-10-01', 22.40], ['2016-07-01', 24.50],
      ['2026-10-23', 22.60]
    ]
  },
  {
    symbol: 'TWX', name: 'Webvan Group', sector: 'Retail', divYield: 0.000,
    ipoDate: '1999-11-05', delistDate: '2001-07-09', volatility: 0.0330,
    bio: 'DOT-COM SHORT TARGET: IPO Nov 5, 1999 at $25! Built automated grocery warehouses before burning $800M and going bankrupt Jul 9, 2001 ($0.00)!',
    waypoints: [
      ['1999-11-05', 25.00], ['1999-12-01', 30.00], ['2000-04-15', 7.50],
      ['2000-11-01', 1.40], ['2001-04-01', 0.18], ['2001-07-09', 0.00]
    ]
  },
  {
    symbol: 'SHLD', name: 'Sears Holdings', sector: 'Retail', divYield: 0.000,
    ipoDate: '1980-01-02', delistDate: '2018-10-15', volatility: 0.0195,
    bio: 'RETAIL APOCALYPSE SHORT TARGET: America’s 20th-century retail king peaked at $190 in 2007 after merging with Kmart before collapsing into Chapter 11 Oct 15, 2018 ($0.00)!',
    waypoints: [
      ['1980-01-02', 14.00], ['1990-01-02', 26.00], ['2000-01-03', 31.00],
      ['2005-03-24', 132.00], ['2007-04-16', 191.90], ['2008-11-20', 31.50],
      ['2014-01-02', 36.00], ['2017-06-01', 6.80], ['2018-10-15', 0.00]
    ]
  },
  {
    symbol: 'SIVB', name: 'Silicon Valley Bank (SVB)', sector: 'Finance', divYield: 0.000,
    ipoDate: '1988-10-28', delistDate: '2023-03-10', volatility: 0.0225,
    bio: 'BANK RUN SHORT TARGET: IPO Oct 28, 1988; soared to $755 in Nov 2021 banking VC tech startups before bond losses triggered a 48-hour collapse on Mar 10, 2023 ($0.00)!',
    waypoints: [
      ['1988-10-28', 1.50], ['2000-09-01', 58.00], ['2002-10-09', 15.20],
      ['2008-09-01', 62.00], ['2009-03-09', 14.80], ['2018-08-01', 318.00],
      ['2021-11-15', 755.00], ['2023-02-01', 312.00], ['2023-03-08', 267.00],
      ['2023-03-09', 106.04], ['2023-03-10', 0.00]
    ]
  },

  // --- DEDICATED CRYPTO ECOSYSTEM EXPANSION (2011-2026) ---
  {
    symbol: 'LTC', name: 'Litecoin (LTC)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2011-10-13', delistDate: null, volatility: 0.0350,
    bio: 'Launched Oct 13, 2011 by Charlie Lee as "Silver to Bitcoin’s Gold." Surged in the 2013, 2017, and 2021 crypto bull cycles.',
    waypoints: [
      ['2011-10-13', 3.00], ['2012-06-01', 0.08], ['2013-11-28', 48.00],
      ['2015-01-14', 1.35], ['2017-12-19', 358.00], ['2018-12-14', 23.50],
      ['2021-05-10', 410.00], ['2022-06-14', 43.00], ['2026-10-23', 96.00]
    ]
  },
  {
    symbol: 'XRP', name: 'XRP / Ripple (XRP)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2013-08-04', delistDate: null, volatility: 0.0390,
    bio: 'Launched Aug 4, 2013 at $0.006! Cross-border payment ledger that exploded 500x in 2017 to $3.40 and rallied past $2.40 after SEC clarity.',
    waypoints: [
      ['2013-08-04', 0.01], ['2014-12-01', 0.02], ['2017-03-01', 0.01],
      ['2018-01-04', 3.40], ['2020-03-16', 0.14], ['2021-04-14', 1.84],
      ['2022-06-18', 0.31], ['2024-12-03', 2.65], ['2026-10-23', 2.45]
    ]
  },
  {
    symbol: 'DOGE', name: 'Dogecoin (100x Unit DOGE)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2013-12-16', delistDate: null, volatility: 0.0440,
    bio: 'Launched Dec 16, 2013 (priced per 100 DOGE). Started as a Shiba Inu joke, then rocketed 200x in 2021 on Elon Musk tweets & retail mania!',
    waypoints: [
      ['2013-12-16', 0.03], ['2015-05-01', 0.01], ['2018-01-08', 1.70],
      ['2020-03-16', 0.15], ['2021-01-29', 4.80], ['2021-05-07', 73.10],
      ['2022-10-14', 5.90], ['2024-11-12', 41.50], ['2026-10-23', 36.00]
    ]
  },
  {
    symbol: 'MSTR', name: 'MicroStrategy (BTC Treasury)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '1998-06-11', delistDate: null, volatility: 0.0320,
    bio: 'IPO Jun 11, 1998. Dot-com flyer that crashed in Mar 2000, then pivoted in Aug 2020 into a leveraged Bitcoin treasury juggernaut!',
    waypoints: [
      ['1998-06-11', 1.20], ['2000-03-10', 31.30], ['2002-07-25', 0.05],
      ['2010-12-31', 0.85], ['2020-08-11', 1.35], ['2021-02-09', 12.70],
      ['2022-12-28', 1.42], ['2024-11-20', 473.00], ['2026-10-23', 395.00]
    ]
  },
  {
    symbol: 'BNB', name: 'BNB Chain (BNB)', sector: 'Crypto', divYield: 0.020,
    ipoDate: '2017-07-25', delistDate: null, volatility: 0.0340,
    bio: 'Launched Jul 25, 2017 at $0.11! Exchange & smart-contract utility token with quarterly token burns that compounded over 6,000x.',
    waypoints: [
      ['2017-07-25', 0.11], ['2018-01-12', 24.00], ['2018-12-14', 4.50],
      ['2021-05-10', 675.00], ['2022-06-18', 197.00], ['2024-06-06', 710.00],
      ['2026-10-23', 685.00]
    ]
  },
  {
    symbol: 'LINK', name: 'Chainlink (LINK)', sector: 'Crypto', divYield: 0.015,
    ipoDate: '2017-09-20', delistDate: null, volatility: 0.0360,
    bio: 'Launched Sep 20, 2017 at $0.19. Decentralized oracle network connecting smart contracts to real-world market data & banking rails.',
    waypoints: [
      ['2017-09-20', 0.19], ['2019-06-29', 3.80], ['2020-08-17', 19.50],
      ['2021-05-10', 52.20], ['2022-11-21', 5.60], ['2024-12-03', 24.80],
      ['2026-10-23', 28.50]
    ]
  },
  {
    symbol: 'ADA', name: 'Cardano (ADA)', sector: 'Crypto', divYield: 0.035,
    ipoDate: '2017-10-02', delistDate: null, volatility: 0.0370,
    bio: 'Launched Oct 2, 2017 at $0.03 (3.5% Staking Yield). Proof-of-stake smart contract platform that surged 100x to $3.09 in Sep 2021.',
    waypoints: [
      ['2017-10-02', 0.03], ['2018-01-04', 1.15], ['2020-03-13', 0.03],
      ['2021-09-02', 3.09], ['2022-12-30', 0.25], ['2024-12-03', 1.22],
      ['2026-10-23', 1.15]
    ]
  },
  {
    symbol: 'LUNA', name: 'Terra / LUNA (Algorithmic)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2019-07-26', delistDate: '2022-05-13', volatility: 0.0420,
    bio: 'CRYPTO DEATH SPIRAL SHORT TARGET: Soared to $119 on Apr 5, 2022 backing UST stablecoin before collapsing to $0.00 on May 13, 2022!',
    waypoints: [
      ['2019-07-26', 1.30], ['2020-03-16', 0.15], ['2021-03-22', 21.80],
      ['2021-05-24', 5.20], ['2021-12-27', 99.50], ['2022-04-05', 119.18],
      ['2022-05-05', 82.50], ['2022-05-09', 32.00], ['2022-05-11', 1.10],
      ['2022-05-13', 0.00]
    ]
  },
  {
    symbol: 'FTT', name: 'FTX Exchange Token (FTT)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2019-07-29', delistDate: '2022-11-11', volatility: 0.0360,
    bio: 'CRYPTO FRAUD SHORT TARGET: Peaked at $84 in Sep 2021 before Coindesk exposed Alameda’s balance sheet, triggering a Nov 11, 2022 bankruptcy ($0.00)!',
    waypoints: [
      ['2019-07-29', 1.80], ['2020-12-31', 5.75], ['2021-05-10', 61.50],
      ['2021-09-09', 84.18], ['2022-03-28', 51.00], ['2022-11-01', 25.80],
      ['2022-11-08', 5.50], ['2022-11-11', 0.00]
    ]
  },
  {
    symbol: 'SOL', name: 'Solana (SOL)', sector: 'Crypto', divYield: 0.050,
    ipoDate: '2020-04-10', delistDate: null, volatility: 0.0410,
    bio: 'Launched Apr 10, 2020 at $0.78 (5.0% Staking Yield)! Soared to $259 in 2021, crashed to $9.60 after FTX in Dec 2022, then roared back past $240!',
    waypoints: [
      ['2020-04-10', 0.78], ['2020-12-23', 1.50], ['2021-05-18', 55.90],
      ['2021-11-05', 259.90], ['2022-12-29', 9.60], ['2023-12-26', 121.00],
      ['2024-11-22', 263.00], ['2026-10-23', 248.00]
    ]
  },
  {
    symbol: 'UNI', name: 'Uniswap DEX (UNI)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2020-09-17', delistDate: null, volatility: 0.0380,
    bio: 'Launched Sep 17, 2020 via historic 400 UNI airdrop. Leading decentralized automated market maker (AMM) exchange protocol.',
    waypoints: [
      ['2020-09-17', 3.40], ['2020-11-04', 1.95], ['2021-05-03', 44.90],
      ['2022-06-18', 3.65], ['2024-03-06', 15.40], ['2026-10-23', 13.80]
    ]
  },
  {
    symbol: 'AVAX', name: 'Avalanche (AVAX)', sector: 'Crypto', divYield: 0.045,
    ipoDate: '2020-09-22', delistDate: null, volatility: 0.0395,
    bio: 'Launched Sep 22, 2020 at $4.50 (4.5% Staking Yield). High-throughput subnet blockchain platform that surged past $144 in Nov 2021.',
    waypoints: [
      ['2020-09-22', 4.50], ['2021-02-10', 55.00], ['2021-07-20', 9.50],
      ['2021-11-22', 144.96], ['2022-12-30', 10.90], ['2024-03-18', 60.50],
      ['2026-10-23', 46.00]
    ]
  },
  {
    symbol: 'SHIB', name: 'Shiba Inu (1M Unit SHIB)', sector: 'Crypto', divYield: 0.000,
    ipoDate: '2021-01-29', delistDate: null, volatility: 0.0460,
    bio: 'Unlocks Jan 29, 2021 (priced per 1,000,000 SHIB). Ethereum-based meme token that staged a historic 80x rally in Oct 2021.',
    waypoints: [
      ['2021-01-29', 1.00], ['2021-05-10', 34.00], ['2021-07-20', 6.20],
      ['2021-10-28', 86.10], ['2022-12-28', 8.10], ['2024-03-05', 39.50],
      ['2026-10-23', 26.00]
    ]
  }
];

const ASSET_MAP = {};
(function generateAllPriceSeries() {
  const marketRng = mulberry32(19800102);
  const marketDailyShocks = new Float32Array(TOTAL_DAYS);
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const u1 = Math.max(1e-7, marketRng());
    const u2 = marketRng();
    marketDailyShocks[i] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  ASSETS_CONFIG.forEach((cfg, idx) => {
    const ipoIdx = findDayIndex(cfg.ipoDate);
    const delistIdx = cfg.delistDate ? findDayIndex(cfg.delistDate) : null;
    const prices = new Float32Array(TOTAL_DAYS);
    const wps = cfg.waypoints.map(([dt, p]) => [findDayIndex(dt), p]);
    const rng = mulberry32(19800102 + (idx + 1) * 7919);

    for (let w = 0; w < wps.length - 1; w++) {
      const [dStart, pStart] = wps[w];
      const [dEnd, pEnd] = wps[w + 1];
      const span = Math.max(1, dEnd - dStart);

      if (pEnd <= 0.0001) {
        for (let d = dStart; d < dEnd; d++) {
          const frac = (d - dStart) / span;
          prices[d] = Math.max(0.05, pStart * Math.pow(1 - frac, 1.55));
        }
        prices[dEnd] = 0.0;
        continue;
      }

      const logStart = Math.log(pStart);
      const logEnd = Math.log(pEnd);
      const tempWalk = new Float32Array(span + 1);
      tempWalk[0] = 0;
      for (let s = 1; s <= span; s++) {
        const u1 = Math.max(1e-7, rng());
        const u2 = rng();
        const zIdio = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const zTotal = 0.55 * marketDailyShocks[dStart + s] + 0.835 * zIdio;
        const vol = cfg.symbol === 'SPX' ? 0.0065 : cfg.volatility * 0.65;
        tempWalk[s] = tempWalk[s - 1] + zTotal * vol;
      }
      const endDrift = tempWalk[span];
      for (let s = 0; s <= span; s++) {
        const frac = s / span;
        const bridgeNoise = tempWalk[s] - frac * endDrift;
        const logP = logStart + frac * (logEnd - logStart) + bridgeNoise;
        prices[dStart + s] = Math.max(0.01, Math.exp(logP));
      }
    }

    const lastWpDay = wps[wps.length - 1][0];
    const lastWpPrice = wps[wps.length - 1][1];
    for (let d = lastWpDay + 1; d < TOTAL_DAYS; d++) {
      prices[d] = delistIdx !== null && d >= delistIdx ? 0 : lastWpPrice;
    }

    ASSET_MAP[cfg.symbol] = {
      ...cfg,
      ipoIdx,
      delistIdx,
      prices
    };
  });
})();

// =========================================================================
// 3. HISTORICAL NEWS EVENTS (1980-2026)
// =========================================================================
const HISTORICAL_EVENTS = [
  { date: '1980-01-02', type: 'MACRO', pause: false, headline: 'Welcome to Jan 1980: Gold (GLD) surges past $600/oz as Fed Chair Paul Volcker battles 13.5% inflation.' },
  { date: '1980-12-02', type: 'IPO', pause: true, headline: 'IPO ALERT: Athletic shoe disruptor Nike (NKE) goes public at $0.18 split-adjusted.' },
  { date: '1980-12-12', type: 'IPO', pause: true, headline: 'IPO ALERT: Apple Computer (AAPL) goes public at $0.50, creating more millionaires than any IPO since Ford.' },
  { date: '1981-06-01', type: 'MACRO', pause: false, headline: 'Volcker hikes Federal Funds Rate above 19%—uninvested cash in your Money Market earns 19% APY!' },
  { date: '1981-09-22', type: 'IPO', pause: true, headline: 'IPO ALERT: The Home Depot (HD) debuts on NASDAQ, launching the big-box DIY revolution.' },
  { date: '1984-10-17', type: 'IPO', pause: false, headline: 'IPO ALERT: UnitedHealth Group (UNH) goes public at $0.08 split-adjusted.' },
  { date: '1985-12-05', type: 'IPO', pause: true, headline: 'IPO ALERT: Membership warehouse pioneer Costco Wholesale (COST) debuts on NASDAQ!' },
  { date: '1986-03-12', type: 'IPO', pause: true, headline: 'BACK-TO-BACK TECH IPOs: Oracle (ORCL) goes public Mar 12, followed by Microsoft (MSFT) on Mar 13!' },
  { date: '1986-03-13', type: 'IPO', pause: true, headline: 'IPO ALERT: Bill Gates takes Microsoft (MSFT) public! Shares surge 31% on opening day.' },
  { date: '1987-10-19', type: 'CRASH', pause: true, headline: 'BLACK MONDAY CRASH: Program trading triggers a 20.5% single-day collapse across Wall Street!' },
  { date: '1990-02-16', type: 'IPO', pause: true, headline: 'IPO ALERT: Internet router pioneer Cisco Systems (CSCO) goes public on NASDAQ.' },
  { date: '1991-12-04', type: 'BANKRUPTCY', pause: true, headline: 'DELISTING ALERT: Pan American World Airways (PNAA) ceases operations—short sellers cash in 100%!' },
  { date: '1991-12-13', type: 'IPO', pause: false, headline: 'IPO ALERT: Wireless chip pioneer Qualcomm (QCOM) debuts on NASDAQ.' },
  { date: '1992-06-26', type: 'IPO', pause: true, headline: 'IPO ALERT: Howard Schultz takes Seattle coffee chain Starbucks (SBUX) public!' },
  { date: '1994-05-03', type: 'IPO', pause: true, headline: 'IPO ALERT: American Express spins off 144-year-old investment bank Lehman Brothers (LEH).' },
  { date: '1997-05-15', type: 'IPO', pause: true, headline: 'IPO ALERT: Jeff Bezos takes online bookseller Amazon.com (AMZN) public on NASDAQ.' },
  { date: '1999-01-22', type: 'IPO', pause: true, headline: 'IPO ALERT: 3D graphics chipmaker NVIDIA (NVDA) debuts on NASDAQ at $0.04 split-adjusted.' },
  { date: '1999-05-04', type: 'IPO', pause: false, headline: 'IPO ALERT: Wall Street powerhouse Goldman Sachs (GS) goes public at $53/share.' },
  { date: '2000-02-11', type: 'IPO', pause: true, headline: 'DOT-COM BUBBLE ALERT: Pets.com (IPET) IPOs at $11.00—prime short-selling candidate before Nov 2000 collapse!' },
  { date: '2000-03-24', type: 'CRASH', pause: true, headline: 'DOT-COM BUBBLE PEAK: NASDAQ & S&P 500 hit record highs; Cisco briefly tops world market cap.' },
  { date: '2000-11-07', type: 'BANKRUPTCY', pause: true, headline: 'BANKRUPTCY ALERT: Pets.com (IPET) liquidates just 268 days after its IPO ($0.00)!' },
  { date: '2001-12-02', type: 'BANKRUPTCY', pause: true, headline: 'BANKRUPTCY ALERT: Enron Corp. (ENE) files Chapter 11 after accounting fraud—shares wiped out at $0.00!' },
  { date: '2002-02-13', type: 'IPO', pause: false, headline: 'IPO ALERT: Video-game retailer GameStop (GME) debuts on NYSE.' },
  { date: '2002-05-23', type: 'IPO', pause: true, headline: 'IPO ALERT: DVD-by-mail disruptor Netflix (NFLX) goes public on NASDAQ.' },
  { date: '2002-07-21', type: 'BANKRUPTCY', pause: true, headline: 'BANKRUPTCY ALERT: Telecom giant WorldCom (WCOM) files Chapter 11 after $11B accounting scandal ($0.00)!' },
  { date: '2004-08-19', type: 'IPO', pause: true, headline: 'IPO ALERT: Search engine leader Google / Alphabet (GOOG) debuts via Dutch auction IPO.' },
  { date: '2008-03-19', type: 'IPO', pause: false, headline: 'IPO ALERT: Global payments network Visa (V) goes public amid the 2008 financial storm.' },
  { date: '2008-09-15', type: 'BANKRUPTCY', pause: true, headline: 'GLOBAL FINANCIAL CRISIS: Lehman Brothers (LEH) files largest bankruptcy in US history ($0.00)!' },
  { date: '2009-03-09', type: 'BULL', pause: true, headline: 'GENERATIONAL BOTTOM: S&P 500 bottoms at 676.53 as Fed launches QE—11-year bull market begins!' },
  { date: '2010-06-29', type: 'IPO', pause: true, headline: 'IPO ALERT: Electric automaker Tesla (TSLA) goes public on NASDAQ.' },
  { date: '2010-09-23', type: 'BANKRUPTCY', pause: true, headline: 'BANKRUPTCY ALERT: Blockbuster Video (BBI) files Chapter 11 as Netflix streaming takes over ($0.00)!' },
  { date: '2011-01-03', type: 'IPO', pause: true, headline: 'CRYPTO UNLOCKED: Bitcoin Spot Trust (BTC) begins trading at $0.30!' },
  { date: '2012-01-19', type: 'BANKRUPTCY', pause: true, headline: 'BANKRUPTCY ALERT: Photography icon Eastman Kodak (KODK) files Chapter 11 ($0.00)!' },
  { date: '2012-05-18', type: 'IPO', pause: true, headline: 'IPO ALERT: Mark Zuckerberg takes Facebook / Meta (META) public at $38/share.' },
  { date: '2015-05-21', type: 'IPO', pause: false, headline: 'IPO ALERT: E-commerce software platform Shopify (SHOP) goes public.' },
  { date: '2020-03-23', type: 'CRASH', pause: true, headline: 'COVID-19 CRASH BOTTOM: S&P 500 plunges 34% in 23 trading days; Fed announces unlimited QE.' },
  { date: '2020-09-30', type: 'IPO', pause: false, headline: 'IPO ALERT: Defense & AI analytics firm Palantir (PLTR) lists on NYSE.' },
  { date: '1983-06-17', type: 'IPO', pause: false, headline: 'IPO ALERT: Biotech pioneer Amgen (AMGN) debuts on NASDAQ at $0.38 split-adjusted.' },
  { date: '1986-08-20', type: 'IPO', pause: false, headline: 'IPO ALERT: Desktop publishing pioneer Adobe (ADBE) goes public at $0.17 split-adjusted.' },
  { date: '1995-08-15', type: 'IPO', pause: false, headline: 'HIDDEN 5,000-BAGGER: Monster Beverage (MNST) begins trading at $0.01 split-adjusted!' },
  { date: '1999-03-10', type: 'IPO', pause: false, headline: 'INDEX UNLOCKED: NASDAQ-100 Index ETF (QQQ) launches just a year before the Dot-Com peak.' },
  { date: '1999-11-05', type: 'IPO', pause: true, headline: 'DOT-COM SHORT TARGET: Online grocery startup Webvan (TWX) IPOs at $25—burns $800M before July 2001 bankruptcy!' },
  { date: '2001-07-09', type: 'BANKRUPTCY', pause: true, headline: 'BANKRUPTCY ALERT: Webvan (TWX) shuts down all warehouses and files Chapter 11 ($0.00)!' },
  { date: '2006-01-26', type: 'IPO', pause: false, headline: 'IPO ALERT: Fast-casual sensation Chipotle Mexican Grill (CMG) doubles on its NYSE debut!' },
  { date: '2006-05-25', type: 'IPO', pause: false, headline: 'IPO ALERT: Global payment rail Mastercard (MA) goes public at $3.90 split-adjusted.' },
  { date: '2009-08-06', type: 'IPO', pause: false, headline: 'IPO ALERT: Semiconductor powerhouse Broadcom (AVGO) debuts on NASDAQ.' },
  { date: '2011-10-13', type: 'IPO', pause: false, headline: 'CRYPTO UNLOCKED: Litecoin (LTC) launches at $3.00 as "Silver to Bitcoin’s Gold."' },
  { date: '2013-12-16', type: 'IPO', pause: false, headline: 'MEME CRYPTO UNLOCKED: Dogecoin (DOGE) launches as a Shiba Inu parody currency.' },
  { date: '2015-08-07', type: 'IPO', pause: true, headline: 'CRYPTO UNLOCKED: Ethereum (ETH) begins trading at $2.80 with 2.5% staking rewards!' },
  { date: '2017-12-18', type: 'BULL', pause: true, headline: '2017 CRYPTO MANIA PEAK: Bitcoin (BTC) hits $19,400 as XRP, Litecoin, Cardano & BNB skyrocket!' },
  { date: '2020-04-10', type: 'IPO', pause: true, headline: 'CRYPTO UNLOCKED: High-speed blockchain Solana (SOL) debuts at $0.78 with 5% staking yield!' },
  { date: '2022-05-13', type: 'BANKRUPTCY', pause: true, headline: 'CRYPTO CRASH: Terra / LUNA (LUNA) collapses from $119 to $0.00 in a $40B stablecoin death spiral!' },
  { date: '2022-11-11', type: 'BANKRUPTCY', pause: true, headline: 'FTX COLLAPSE: Sam Bankman-Fried’s FTX Token (FTT) plunges to $0.00 in Chapter 11 bankruptcy!' },
  { date: '2018-10-15', type: 'BANKRUPTCY', pause: true, headline: 'BANKRUPTCY ALERT: 125-year-old retail icon Sears Holdings (SHLD) files Chapter 11 ($0.00)!' },
  { date: '2020-09-16', type: 'IPO', pause: false, headline: 'IPO ALERT: Cloud data giant Snowflake (SNOW) debuts in the largest software IPO in history.' },
  { date: '2020-12-10', type: 'IPO', pause: false, headline: 'IPO ALERT: Home-sharing leader Airbnb (ABNB) surges past $144 on opening day.' },
  { date: '2021-01-28', type: 'BULL', pause: true, headline: 'REDDIT SHORT SQUEEZE: GameStop (GME) rockets past $80 split-adjusted as retail traders squeeze hedge funds!' },
  { date: '2023-03-10', type: 'BANKRUPTCY', pause: true, headline: 'BANK RUN COLLAPSE: Silicon Valley Bank (SIVB) seized by regulators after a 48-hour run from $267 to $0.00!' },
  { date: '2023-05-25', type: 'TECH', pause: true, headline: 'AI SUPERCYCLE: NVIDIA (NVDA) shocks Wall Street with surging generative AI data-center demand!' },
  { date: '2026-10-23', type: 'BULL', pause: true, headline: 'PRESENT DAY REACHED (Oct 23, 2026): 46+ years of Wall Street history complete! Save your score to Ranks!' }
].map(ev => ({ ...ev, dayIdx: findDayIndex(ev.date) })).sort((a, b) => a.dayIdx - b.dayIdx);

const EVENT_BY_DAY = {};
HISTORICAL_EVENTS.forEach(ev => { EVENT_BY_DAY[ev.dayIdx] = ev; });

function getEraNameForYear(yr) {
  if (yr < 1983) return '1980–82 Volcker Era';
  if (yr < 1990) return '1980s Reagan Boom';
  if (yr < 1995) return 'Early 90s PC Era';
  if (yr <= 2000) return '1995–00 Dot-Com Mania';
  if (yr <= 2003) return '2000–03 Dot-Com Bust';
  if (yr <= 2007) return '2004–07 Housing Boom';
  if (yr <= 2009) return '2008–09 Financial Crisis';
  if (yr <= 2019) return '2010s Cloud Bull';
  if (yr <= 2022) return '2020–22 Pandemic Era';
  return '2023–26 AI Supercycle';
}

// =========================================================================
// 4. WALL STREET LEGENDS, ACHIEVEMENTS & CUSTOM LEADERBOARD
// =========================================================================
const WALL_ST_LEGENDS = [
  { id: 'legend-quant', name: 'Jim Simons (Medallion Quant)', avatar: '⚡', strategy: 'Algorithmic Quant Signals (24.0% CAGR)', cagr: 0.240, isLegend: true },
  { id: 'legend-lynch', name: 'Peter Lynch (Magellan Style)', avatar: '🚀', strategy: 'Tenbagger Growth Hunter (21.5% CAGR)', cagr: 0.215, isLegend: true },
  { id: 'legend-buffett', name: 'Warren Buffett (Omaha Value)', avatar: '🎩', strategy: 'Berkshire + Coca-Cola + Apple (19.8% CAGR)', cagr: 0.198, isLegend: true },
  { id: 'legend-bogle', name: 'Jack Bogle (S&P 500 Index)', avatar: '🏛️', strategy: '100% SPX Buy & Hold + Reinvested Divs', cagr: null, isLegend: true },
  { id: 'legend-volcker', name: 'T-Bill Cash Saver', avatar: '💵', strategy: '100% Fed Funds Money Market Yield', cagr: 0.048, isLegend: true }
];

const ACHIEVEMENTS_LIST = [
  { id: 'ach_first_trade', icon: '🔔', title: 'Opening Bell', desc: 'Execute your first market order' },
  { id: 'ach_short_profit', icon: '🐻', title: 'Big Short', desc: 'Profit from a Short Sell or Bankruptcy' },
  { id: 'ach_ipo_hunter', icon: '⚡', title: 'IPO Syndicate', desc: 'Queue & fill a Pre-IPO opening order' },
  { id: 'ach_div_collector', icon: '💵', title: 'Dividend Royalty', desc: 'Collect $1,000+ in cash/DRIP dividends' },
  { id: 'ach_100k', icon: '💼', title: '$100K Prop Trader', desc: 'Grow Net Worth past $100,000' },
  { id: 'ach_1m', icon: '🏆', title: 'Millionaire Club', desc: 'Grow Net Worth past $1,000,000' },
  { id: 'ach_10m', icon: '👑', title: 'Deca-Millionaire', desc: 'Grow Net Worth past $10,000,000' },
  { id: 'ach_100m', icon: '💎', title: 'Wall St Centurion', desc: 'Grow Net Worth past $100,000,000' },
  { id: 'ach_survive_87', icon: '🛡️', title: '87 Crash Survivor', desc: 'Navigate past Oct 19, 1987 Black Monday' },
  { id: 'ach_modern_era', icon: '🚀', title: 'Time Traveler', desc: 'Reach the 2020s AI & Crypto era' }
];

const STORAGE_KEY_LEADERBOARD = 'ws_time_machine_custom_lb_v2';
const STORAGE_KEY_CAMPAIGN = 'ws_time_machine_campaign_save_v3';
const STORAGE_KEY_PRESTIGE = 'ws_time_machine_prestige_v1';

const LIFESTYLE_UPGRADES = [
  { id: 'up_rolex', icon: '⌚', name: 'Gold Rolex Day-Date', cost: 25000, buffText: '+0.25% Bonus Cash APY' },
  { id: 'up_countach', icon: '🏎️', name: '1986 Countach Turbo', cost: 125000, buffText: '-25% Short Dividend Drag' },
  { id: 'up_penthouse', icon: '🏙️', name: 'Tribeca Penthouse', cost: 1000000, buffText: '+10% Dividend Payout Boost' },
  { id: 'up_quant', icon: '🖥️', name: 'Quant AI Server Cluster', cost: 5000000, buffText: 'Unlocks 2.5x Margin & -50% Loan Spread' },
  { id: 'up_jet', icon: '✈️', name: 'Gulfstream G650 Jet', cost: 25000000, buffText: '+1.00% Prime Money Market APY' },
  { id: 'up_foundation', icon: '🏛️', name: 'Wall St Philanthropy Fund', cost: 100000000, buffText: 'Philanthropist Crown & +1 Grade Tier' }
];

const SCENARIO_MISSIONS = [
  { id: 'scen_volcker', title: '1980 Volcker Inflation Survivor', startIso: '1980-01-02', endIso: '1985-01-02', startCash: 10000, targetNw: 25000, desc: 'Compound $10k to $25k across the 1980–85 high-rate era.' },
  { id: 'scen_87crash', title: '1987 Black Monday Sniper', startIso: '1987-06-01', endIso: '1989-06-01', startCash: 10000, targetNw: 30000, desc: 'Profit from the Oct 19, 1987 crash with Shorts or Puts!' },
  { id: 'scen_dotcom', title: '2000 Dot-Com Big Short', startIso: '2000-01-03', endIso: '2002-10-09', startCash: 10000, targetNw: 40000, desc: 'Short Pets.com, Webvan, Enron & WorldCom during the bust.' },
  { id: 'scen_lehman', title: '2008 Subprime Crisis Hunter', startIso: '2007-06-01', endIso: '2010-06-01', startCash: 10000, targetNw: 45000, desc: 'Survive the 2008 Lehman collapse and buy the 2009 bottom.' },
  { id: 'scen_crypto', title: '2011 Satoshi Crypto Genesis', startIso: '2011-01-03', endIso: '2018-01-15', startCash: 10000, targetNw: 500000, desc: 'Turn $10k into $500k riding Bitcoin, Litecoin, XRP & Ethereum.' },
  { id: 'scen_ai', title: '2020 Pandemic & AI Supercycle', startIso: '2020-01-02', endIso: '2026-10-23', startCash: 10000, targetNw: 120000, desc: 'Navigate COVID, the 2021 meme squeeze, and the AI boom.' }
].map(s => ({ ...s, startDayIdx: findDayIndex(s.startIso), endDayIdx: findDayIndex(s.endIso) }));

const HISTORICAL_DILEMMAS = [
  {
    id: 'dil_1982', date: '1982-08-12', title: '1982 Volcker Rate Peak Note',
    desc: 'Paul Volcker’s interest rate shock is peaking as inflation cools. A institutional desk offers you a special high-yield Treasury note.',
    choiceATitle: '💵 Lock Treasury Note (+8% Cash Bonus)', choiceADesc: 'Collect an immediate +8% yield credit on your uninvested cash.',
    choiceBTitle: '🚀 Deploy Aggressive Equity Rebate (+$600)', choiceBDesc: 'Receive a $600 prop desk commission rebate to buy stocks at the 1982 bottom.'
  },
  {
    id: 'dil_1987', date: '1987-10-19', title: 'Black Monday Floor Panic!',
    desc: 'The Dow is down 22% in a single session and specialist booths are overwhelmed with sell orders. How does your desk react?',
    choiceATitle: '🩸 Provide Emergency Liquidity (+12% Cash Boost)', choiceADesc: 'Step in as market-maker of last resort and earn a 12% cash liquidity premium.',
    choiceBTitle: '🛡️ Activate Portfolio Put Hedge (+$1,500)', choiceBDesc: 'Collect a $1,500 floor clearinghouse settlement credit.'
  },
  {
    id: 'dil_1999', date: '1999-07-15', title: 'Silicon Valley Pre-IPO Angel Deal',
    desc: 'A Sand Hill Road VC invites you into an oversubscribed dot-com angel round at the height of internet mania.',
    choiceATitle: '🦄 Flip Dot-Com Allocation (+15% Cash)', choiceADesc: 'Flip the hot IPO allocation on opening day for a 15% cash windfall.',
    choiceBTitle: '🏦 Collect Advisory Retainer (+$5,000)', choiceBDesc: 'Skip the bubble risk and pocket a guaranteed $5,000 underwriting retainer.'
  },
  {
    id: 'dil_2008', date: '2008-09-15', title: 'Lehman Collapse & TARP Rescue',
    desc: 'Lehman Brothers just filed Chapter 11 and credit markets are freezing up. The Treasury is assembling emergency capital.',
    choiceATitle: '🏛️ Buy Preferred Bank Warrants (+12% Cash)', choiceADesc: 'Negotiate Buffett-style preferred warrants for an instant +12% cash dividend.',
    choiceBTitle: '📉 Settle CDS Protection (+$10,000)', choiceBDesc: 'Cash in a $10,000 credit default swap protection payout.'
  },
  {
    id: 'dil_2020', date: '2020-03-23', title: 'Unlimited QE & Pandemic Liquidity',
    desc: 'The Fed just announced unlimited Quantitative Easing at the March 2020 bottom. How do you position your fund?',
    choiceATitle: '⚡ Tap Fed Liquidity Facility (+10% Cash)', choiceADesc: 'Boost cash reserves by +10% to buy the generational tech & crypto rebound.',
    choiceBTitle: '💎 Claim $25,000 Volatility Grant', choiceBDesc: 'Collect a flat $25,000 volatility desk rebate.'
  }
].map(d => ({ ...d, dayIdx: findDayIndex(d.date) }));

const DILEMMA_BY_DAY = {};
HISTORICAL_DILEMMAS.forEach(d => { DILEMMA_BY_DAY[d.dayIdx] = d; });

// Deterministic Mystery Code Names for Blind Mode
const MYSTERY_CODE_MAP = {};
(function buildMysteryMap() {
  const counts = {};
  ASSETS_CONFIG.forEach(cfg => {
    const prefix = cfg.sector.toUpperCase().slice(0, 6);
    counts[prefix] = (counts[prefix] || 0) + 1;
    const code = `${prefix}-${String(counts[prefix]).padStart(2, '0')}`;
    MYSTERY_CODE_MAP[cfg.symbol] = {
      code,
      name: `Mystery ${cfg.sector} Asset #${counts[prefix]}`,
      bio: `Blind Mode Active: ${cfg.sector} sector asset (IPO ${cfg.ipoDate.slice(0, 4)}, Yield ${(cfg.divYield * 100).toFixed(1)}%). Trade on price action, 200D SMA & forensic badges!`
    };
  });
})();

function getDailyBlitzScenario() {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const rng = mulberry32(seed);
  const maxStartDay = TOTAL_DAYS - 1300;
  const startDayIdx = Math.floor(rng() * maxStartDay);
  const endDayIdx = Math.min(TOTAL_DAYS - 1, startDayIdx + 1260); // 5 trading years
  const startYr = TRADING_DATES[startDayIdx].year;
  const endYr = TRADING_DATES[endDayIdx].year;
  return {
    id: 'daily_blitz_' + seed,
    title: `Daily Blitz (${startYr}–${endYr})`,
    startDayIdx,
    endDayIdx,
    startCash: 10000,
    targetNw: 30000,
    desc: `${TRADING_DATES[startDayIdx].iso} to ${TRADING_DATES[endDayIdx].iso}: Turn $10,000 into $30,000 in 5 years!`
  };
}

const FEATURE_TOUR_ITEMS = [
  {
    id: 'feat_time', badge: 'CORE LOOP', icon: '⏱️', title: '1. Real-Time Ticker, Speed Slider & Step Controls',
    screen: 'trade', spotlightId: 'btnPlayPause',
    visualWireframe: '[ ▶ PLAY ] [+1D] [+1W] [+1M]  •  Speed: 1d/s ━━●━━ 1yr/s (252d/s)',
    summary: 'Time ticks forward continuously from Jan 2, 1980 to Oct 23, 2026. Pause on any trading day or use 1yr/s (252d/s) to blitz a decade in seconds.',
    hotTip: 'Keep Event Auto-Pause (ON) during fast-forwards so the game automatically pauses on IPO days and market crashes!'
  },
  {
    id: 'feat_chart', badge: 'ANALYTICS', icon: '📈', title: '2. High-DPI Chart, 200D SMA & Trade Markers (▲/▼/◆)',
    screen: 'trade', spotlightId: 'mainChartCanvas',
    visualWireframe: 'Price Curve ╱╲╱▲(Buy)━━━ 200D SMA (Indigo) ━━━ ◆(Short)╲▼(Sell)',
    summary: 'Scrub across the chart with your finger or mouse to inspect historical prices, toggle the 200-Day Moving Average, or compare Net Worth vs S&P 500.',
    hotTip: 'When a stock crosses ABOVE its indigo 200D SMA line after a crash, it often signals a multi-year bull trend.'
  },
  {
    id: 'feat_prodesk', badge: 'PRO DESK', icon: '⚡', title: '3. Long, Short Selling & 1.5x / 2x / 2.5x Margin',
    screen: 'trade', spotlightId: 'btnExecuteBuy',
    visualWireframe: 'Margin: [1x] [1.5x] [2x] [2.5x]  •  [ BUY LONG ] [ SELL ] [ 📉 SHORT ]',
    summary: 'Go Long compounders, Short overvalued bubbles down to $0.00 bankruptcy, or amplify buying power with Prime Broker Margin.',
    hotTip: 'Avoid using 2x Margin in 1980–1982 when Volcker Fed interest rates are 19%—margin loan interest will eat your cash!'
  },
  {
    id: 'feat_options', badge: '5X LEVERAGE', icon: '🎯', title: '4. 30-Day 5x Leveraged Call & Put Options Desk',
    screen: 'trade', spotlightId: 'btnBuyCallOption', openDetails: true,
    visualWireframe: '[ 📈 30D Call (5x) ]  [ 📉 30D Put (5x) ]  •  Auto-settles in 30d',
    summary: 'Arcade contracts, not real options pricing: 5x the signed underlying return over 30 simulation sessions, with losses capped at the premium. No time decay, implied volatility, or exercise.',
    hotTip: 'Buying a 30D 5x Put on Oct 14, 1987 (right before Black Monday) or on Lehman Brothers in Sep 2008 delivers massive payouts!'
  },
  {
    id: 'feat_preipo', badge: 'AUTOMATION', icon: '🔔', title: '5. Pre-IPO Syndicate Auto-Buy & -10% Limit Queue',
    screen: 'trade', spotlightId: 'btnQueueDipLimitOrder', openDetails: true,
    visualWireframe: '[ ⚡ Pre-Order IPO ($1,000) ]  •  [ 🎯 Limit -10% Dip Buy ]',
    summary: 'Select any locked Pre-IPO asset (AAPL, MSFT, NVDA, BTC) to queue an automatic Day-1 opening-bell buy order, or queue -10% dip buys.',
    hotTip: 'On Day 1 (Jan 2, 1980), immediately queue Pre-IPO orders for NKE (Dec 2, 1980) and AAPL (Dec 12, 1980)!'
  },
  {
    id: 'feat_market', badge: '98 ASSETS', icon: '🏛️', title: '6. 98-Asset Market Explorer (Stocks, Gold, Oil & 16 Cryptos)',
    screen: 'market', spotlightId: 'marketSearchInput',
    visualWireframe: '[All (98)] [🪙 Crypto (16)] [Tech/AI] [Tradable Now] [Upcoming IPOs]',
    summary: 'Filter 82 stocks, indices, and commodities plus 16 cryptocurrencies (BTC, ETH, SOL, DOGE, LUNA, FTT) and 12 historical bankruptcies.',
    hotTip: 'Look at the Forensic Badge on the Trade screen: "🚨 Debt/Fraud Alert" warns you within 2 years of a company filing Chapter 11!'
  },
  {
    id: 'feat_mystery', badge: 'HARD MODE', icon: '🕵️', title: '7. Blind Mystery Ticker Mode (Anti-Hindsight)',
    screen: 'trade', spotlightId: 'btnMysteryToggle',
    visualWireframe: '🕵️ Blind: ON  →  MACRO-01  •  TECH-01  •  CRYPTO-01',
    summary: 'Masks asset labels and search until bankruptcy or campaign end. Trade on technicals, yield, and risk badges; historical context may still provide clues.',
    hotTip: 'In Blind Mode, check the Yield % and Forensic Badge: "🛡️ Dividend Payer" marks safe compounders while "🚨 Debt/Fraud Alert" marks shorts!'
  },
  {
    id: 'feat_lifestyle', badge: 'PROGRESSION', icon: '🎩', title: '8. DRIP Compounding & Tycoon Lifestyle Upgrades',
    screen: 'portfolio', spotlightId: 'lifestyleShopContainer',
    visualWireframe: 'DRIP: [ON]  •  ⌚ Rolex (+0.25% APY)  •  🖥️ Quant AI (2.5x Margin)',
    summary: 'Reinvest quarterly dividends automatically with DRIP and spend cash profits on 6 Lifestyle & Fund upgrades that grant permanent buffs.',
    hotTip: 'Turn DRIP ON when holding high-yield stalwarts like Altria (PM, 6.8% yield), Exxon (XOM), or Coca-Cola (KO).'
  },
  {
    id: 'feat_scenarios', badge: 'CHALLENGES', icon: '🔥', title: '9. Daily 5-Year Blitz, 6 Scenarios & Interactive Dilemmas',
    screen: 'trade', spotlightId: 'btnOpenEraModal',
    visualWireframe: '🔥 Daily 5-Year Blitz  •  🎯 6 Scenario Missions  •  ⚡ 2-Choice Dilemmas',
    summary: 'Play a seeded 5-year challenge every day, tackle 6 historical missions, and resolve interactive 2-choice market dilemmas.',
    hotTip: 'In Scenario Missions, use the header progress bar to track your exact % toward the target Net Worth before the deadline.'
  },
  {
    id: 'feat_wrapup', badge: 'RETENTION', icon: '🏅', title: '10. Career Scorecard, Shareable Rival Codes & ★ Prestige',
    screen: 'leaderboard', spotlightId: 'btnOpenWrapUpModal',
    visualWireframe: 'Grade: [ S+ ]  •  📋 Copy WSTM-... Code  •  ★ Retire & Claim Prestige',
    summary: 'View your Career Grade (S+ to F), export a WSTM-... code for friends to import on their Leaderboard, or Retire at ≥$50k for +1 Prestige Star!',
    hotTip: 'Each Prestige Star (★) permanently boosts your starting cash by +25%, adds +0.50% Cash APY, and unlocks 2.5x Margin from Day 1!'
  }
];

const PRO_HOT_TIPS = [
  { cat: 'era', eraRange: [1980, 1983], title: '1980–82 Volcker Cash King', body: 'Fed Chair Paul Volcker pushed interest rates to 19.1% in 1981. Uninvested cash earns massive risk-free daily interest while you wait for Dec 1980 IPOs (NKE & AAPL).' },
  { cat: 'era', eraRange: [1983, 1987], title: '1986 Back-to-Back Tech IPOs', body: 'Oracle (ORCL) IPOs on Mar 12, 1986 at $0.09 and Microsoft (MSFT) IPOs the very next day on Mar 13, 1986 at $0.35. Queue Pre-IPO orders for both!' },
  { cat: 'era', eraRange: [1987, 1989], title: 'Oct 19, 1987 Black Monday Sniper', body: 'Markets plunge 20.5% on Oct 19, 1987. Raise cash or buy 30D 5x Puts in early October, then buy the dip on Oct 20!' },
  { cat: 'era', eraRange: [1990, 1996], title: '1991 Pan Am Bankruptcy & 90s Compounders', body: 'Pan Am (PNAA) files Chapter 11 on Dec 4, 1991 ($0.00). Short it in 1990–91, then rotate into Cisco (CSCO), Home Depot (HD), and Monster Beverage (MNST, Aug 1995).' },
  { cat: 'era', eraRange: [1997, 2000], title: '1999 Qualcomm & Dot-Com Mania', body: 'Qualcomm (QCOM), Cisco (CSCO), and MicroStrategy (MSTR) skyrocket through 1999 into March 2000. Ride Call options up, then flip to Shorts in March 2000!' },
  { cat: 'era', eraRange: [2000, 2003], title: '2000–2002 The Fraud & Dot-Com Big Short', body: 'Pets.com (Nov 2000), Webvan (Jul 2001), Enron (Dec 2001), and WorldCom (Jul 2002) all go to $0.00! Shorting them locks in +100% bankruptcy wins.' },
  { cat: 'era', eraRange: [2004, 2009], title: '2008 Lehman Collapse & Generational Bottom', body: 'Lehman Brothers (LEH) collapses to $0.00 on Sep 15, 2008. Short LEH in mid-2008, then go all-in Long on Mar 9, 2009 when the S&P 500 bottoms at 676!' },
  { cat: 'era', eraRange: [2010, 2018], title: '2011–2017 Bitcoin & Crypto Halving Cycles', body: 'Bitcoin (BTC) unlocks Jan 3, 2011 at $0.30, surging in 2013 and 2017, but watch out for 80% crypto winters in 2014 and 2018!' },
  { cat: 'era', eraRange: [2019, 2026], title: '2020–2026 GME Squeeze, LUNA/FTX Shorts & AI Boom', body: 'Ride GameStop (GME) & Solana (SOL) in 2021, Short Terra/LUNA (May 2022) & FTX/FTT (Nov 2022) to $0.00, and ride NVIDIA (NVDA) & Palantir (PLTR) in 2023–26!' },
  { cat: 'pro', eraRange: [1980, 2026], title: 'How 30-Day 5x Options Work', body: 'Arcade options pay max(0, premium × (1 + 5 × signed return)) after 30 simulation sessions (or earlier at cash-out/bankruptcy). Calls use the price return; Puts negate it. A +20% move doubles a Call; a -20% move wipes it out. No time decay, implied volatility, or exercise.' },
  { cat: 'pro', eraRange: [1980, 2026], title: 'Forensic Risk Badge Early Warning', body: 'Watch the badge next to the sector tag on the Trade screen: "🚨 Debt/Fraud Alert" appears 500 trading days before a stock files Chapter 11 bankruptcy.' },
  { cat: 'pro', eraRange: [1980, 2026], title: 'Partial Short Covering & Position Trimming', body: 'Use "Sell 25% Pos" or "Sell 50% Pos" inside Pro Orders to lock in partial profits on both Long AND Short positions without closing your entire trade.' },
  { cat: 'pro', eraRange: [1980, 2026], title: 'Pre-IPO Syndicate Queueing', body: 'You do not have to wait for an IPO date! Select any locked stock in the Market tab and tap "⚡ Pre-Order IPO" so it auto-buys on opening bell.' },
  { cat: 'blind', eraRange: [1980, 2026], title: 'Winning in Blind Mystery Mode', body: 'When tickers are masked (TECH-01, RETAIL-02), combine the 200D SMA trendline, Dividend Yield %, and Forensic Badge to separate winners from traps.' },
  { cat: 'blind', eraRange: [1980, 2026], title: 'Stacking Roguelite Prestige Stars (★)', body: 'As soon as your Net Worth hits $50,000, you can tap 🏅 in the header and Retire to claim +1 Prestige Star (+25% starting capital & +0.50% APY permanently).' },
  { cat: 'blind', eraRange: [1980, 2026], title: 'Challenging Friends with WSTM Codes', body: 'Open the 🏅 Scorecard modal, copy your WSTM-... code, and send it to a friend. They can paste it under Ranks → + Custom Rival to race your exact score!' }
];

const WALKTHROUGH_STEPS = [
  { step: 1, title: 'Step 1: Execute Your First Buy Order', desc: 'Go to the Trade screen, pick an order amount (or tap 25%), and tap BUY to open a Long position with ▲ chart markers.', screen: 'trade', spotlightId: 'btnExecuteBuy' },
  { step: 2, title: 'Step 2: Queue a Pre-IPO Auto-Buy (Apple Dec 1980)', desc: 'Select Apple (AAPL) before Dec 12, 1980 and tap ⚡ Pre-Order IPO so your desk automatically buys at the opening bell.', screen: 'trade', spotlightId: 'btnQueuePreIpoOrder', selectSym: 'AAPL' },
  { step: 3, title: 'Step 3: Open a Short or 30D 5x Put on a Trap', desc: 'Open the ⚡ Pro Orders drawer and tap 📉 Short or 📉 30D Put (5x) to profit when overleveraged stocks fall.', screen: 'trade', spotlightId: 'btnBuyPutOption', openDetails: true },
  { step: 4, title: 'Step 4: Enable DRIP & Buy Lifestyle Buffs', desc: 'Switch to the Portfolio screen, toggle DRIP: ON to auto-compound dividends, and inspect the 6 Tycoon Lifestyle Upgrades.', screen: 'portfolio', spotlightId: 'btnToggleDrip' },
  { step: 5, title: 'Step 5: Try Blind Mystery Mode (Anti-Hindsight)', desc: 'Tap 🕵️ in the top header to mask all 98 tickers and test your pure chart-reading and forensic skills.', screen: 'trade', spotlightId: 'btnMysteryToggle' },
  { step: 6, title: 'Step 6: Launch the Daily 5-Year Blitz or Claim Prestige', desc: 'Tap ⏳ in the header to start today’s seeded 5-Year Blitz Challenge, or tap 🏅 to view your Career Scorecard & Prestige.', screen: 'trade', spotlightId: 'btnOpenEraModal' }
];


if (typeof module !== "undefined" && module.exports) module.exports = { ASSETS_CONFIG, ASSET_MAP, TRADING_DATES, TOTAL_DAYS, DATE_TO_INDEX, HISTORICAL_EVENTS, EVENT_BY_DAY, DILEMMA_BY_DAY, HISTORICAL_DILEMMAS, SCENARIO_MISSIONS, LIFESTYLE_UPGRADES, ACHIEVEMENTS_LIST, STORAGE_KEY_CAMPAIGN, getFedRateAtDay, getCpiDeflatorAtDay, findDayIndex };
