/**
 * AQI Calculator — follows CPCB (India) & US EPA breakpoints
 * Calculates AQI for PM2.5, PM10, CO, NO2, SO2, O3 individually,
 * then returns the max (dominant pollutant determines overall AQI).
 */

const BREAKPOINTS = {
  pm25: [
    { cLow: 0,    cHigh: 12,   iLow: 0,   iHigh: 50  },
    { cLow: 12.1, cHigh: 35.4, iLow: 51,  iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4,iLow: 151, iHigh: 200 },
    { cLow: 150.5,cHigh: 250.4,iLow: 201, iHigh: 300 },
    { cLow: 250.5,cHigh: 350.4,iLow: 301, iHigh: 400 },
    { cLow: 350.5,cHigh: 500,  iLow: 401, iHigh: 500 },
  ],
  pm10: [
    { cLow: 0,   cHigh: 54,   iLow: 0,   iHigh: 50  },
    { cLow: 55,  cHigh: 154,  iLow: 51,  iHigh: 100 },
    { cLow: 155, cHigh: 254,  iLow: 101, iHigh: 150 },
    { cLow: 255, cHigh: 354,  iLow: 151, iHigh: 200 },
    { cLow: 355, cHigh: 424,  iLow: 201, iHigh: 300 },
    { cLow: 425, cHigh: 504,  iLow: 301, iHigh: 400 },
    { cLow: 505, cHigh: 604,  iLow: 401, iHigh: 500 },
  ],
  no2: [  // ppb
    { cLow: 0,    cHigh: 53,   iLow: 0,   iHigh: 50  },
    { cLow: 54,   cHigh: 100,  iLow: 51,  iHigh: 100 },
    { cLow: 101,  cHigh: 360,  iLow: 101, iHigh: 150 },
    { cLow: 361,  cHigh: 649,  iLow: 151, iHigh: 200 },
    { cLow: 650,  cHigh: 1249, iLow: 201, iHigh: 300 },
    { cLow: 1250, cHigh: 1649, iLow: 301, iHigh: 400 },
    { cLow: 1650, cHigh: 2049, iLow: 401, iHigh: 500 },
  ],
  so2: [  // ppb
    { cLow: 0,   cHigh: 35,   iLow: 0,   iHigh: 50  },
    { cLow: 36,  cHigh: 75,   iLow: 51,  iHigh: 100 },
    { cLow: 76,  cHigh: 185,  iLow: 101, iHigh: 150 },
    { cLow: 186, cHigh: 304,  iLow: 151, iHigh: 200 },
    { cLow: 305, cHigh: 604,  iLow: 201, iHigh: 300 },
    { cLow: 605, cHigh: 804,  iLow: 301, iHigh: 400 },
    { cLow: 805, cHigh: 1004, iLow: 401, iHigh: 500 },
  ],
  co: [  // ppm
    { cLow: 0,    cHigh: 4.4,  iLow: 0,   iHigh: 50  },
    { cLow: 4.5,  cHigh: 9.4,  iLow: 51,  iHigh: 100 },
    { cLow: 9.5,  cHigh: 12.4, iLow: 101, iHigh: 150 },
    { cLow: 12.5, cHigh: 15.4, iLow: 151, iHigh: 200 },
    { cLow: 15.5, cHigh: 30.4, iLow: 201, iHigh: 300 },
    { cLow: 30.5, cHigh: 40.4, iLow: 301, iHigh: 400 },
    { cLow: 40.5, cHigh: 50.4, iLow: 401, iHigh: 500 },
  ],
  o3: [  // ppb, 8-hour
    { cLow: 0,   cHigh: 54,  iLow: 0,   iHigh: 50  },
    { cLow: 55,  cHigh: 70,  iLow: 51,  iHigh: 100 },
    { cLow: 71,  cHigh: 85,  iLow: 101, iHigh: 150 },
    { cLow: 86,  cHigh: 105, iLow: 151, iHigh: 200 },
    { cLow: 106, cHigh: 200, iLow: 201, iHigh: 300 },
  ],
};

function linearInterp(c, bp) {
  const found = bp.find(b => c >= b.cLow && c <= b.cHigh);
  if (!found) return c > bp[bp.length - 1].cHigh ? 500 : 0;
  return Math.round(
    ((found.iHigh - found.iLow) / (found.cHigh - found.cLow)) * (c - found.cLow) + found.iLow
  );
}

function calculateAQI({ pm25, pm10, co, no2, so2, o3 }) {
  const aqiValues = {
    pm25: pm25 != null ? linearInterp(pm25, BREAKPOINTS.pm25) : 0,
    pm10: pm10 != null ? linearInterp(pm10, BREAKPOINTS.pm10) : 0,
    co:   co   != null ? linearInterp(co,   BREAKPOINTS.co)   : 0,
    no2:  no2  != null ? linearInterp(no2,  BREAKPOINTS.no2)  : 0,
    so2:  so2  != null ? linearInterp(so2,  BREAKPOINTS.so2)  : 0,
    o3:   o3   != null ? linearInterp(o3,   BREAKPOINTS.o3)   : 0,
  };

  const maxAQI = Math.max(...Object.values(aqiValues));
  const dominant = Object.keys(aqiValues).find(k => aqiValues[k] === maxAQI);

  return { aqi: maxAQI, dominant, breakdown: aqiValues };
}

function getAQICategory(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#22c55e', risk: 'low'      };
  if (aqi <= 100) return { label: 'Satisfactory', color: '#3b82f6', risk: 'low'      };
  if (aqi <= 150) return { label: 'Moderate',     color: '#f59e0b', risk: 'moderate' };
  if (aqi <= 200) return { label: 'Unhealthy',    color: '#f97316', risk: 'high'     };
  if (aqi <= 300) return { label: 'Very Unhealthy',color: '#ef4444', risk: 'very high'};
  return            { label: 'Hazardous',          color: '#7c3aed', risk: 'extreme'  };
}

module.exports = { calculateAQI, getAQICategory };
