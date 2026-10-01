/**
 * F1 Multiverse — Static rating pool (50–99 scale)
 * Schema: drivers pac/rac/wet/con · cars aero/eng/rel · principals tac/rnd
 */

/** Full pool. A season uses the first SEASON_LENGTH rounds. */
export const CALENDAR_24 = [
  { id: 'aus', name: 'Australia GP', flag: '🇦🇺', aeroWeight: 0.35, engineWeight: 0.35, driverWeight: 0.30, baseRainChance: 0.15 },
  { id: 'bhr', name: 'Bahrain GP', flag: '🇧🇭', aeroWeight: 0.32, engineWeight: 0.40, driverWeight: 0.28, baseRainChance: 0.05 },
  { id: 'sau', name: 'Saudi Arabia GP', flag: '🇸🇦', aeroWeight: 0.25, engineWeight: 0.45, driverWeight: 0.30, baseRainChance: 0.02 },
  { id: 'jpn', name: 'Japan GP', flag: '🇯🇵', aeroWeight: 0.42, engineWeight: 0.28, driverWeight: 0.30, baseRainChance: 0.25 },
  { id: 'chn', name: 'China GP', flag: '🇨🇳', aeroWeight: 0.35, engineWeight: 0.35, driverWeight: 0.30, baseRainChance: 0.20 },
  { id: 'mia', name: 'Miami GP', flag: '🇺🇸', aeroWeight: 0.30, engineWeight: 0.40, driverWeight: 0.30, baseRainChance: 0.30 },
  { id: 'emi', name: 'Emilia Romagna GP', flag: '🇮🇹', aeroWeight: 0.45, engineWeight: 0.25, driverWeight: 0.30, baseRainChance: 0.20 },
  { id: 'mon', name: 'Monaco GP', flag: '🇲🇨', aeroWeight: 0.55, engineWeight: 0.10, driverWeight: 0.35, baseRainChance: 0.15 },
  { id: 'can', name: 'Canada GP', flag: '🇨🇦', aeroWeight: 0.28, engineWeight: 0.42, driverWeight: 0.30, baseRainChance: 0.35 },
  { id: 'esp', name: 'Spain GP', flag: '🇪🇸', aeroWeight: 0.45, engineWeight: 0.28, driverWeight: 0.27, baseRainChance: 0.10 },
  { id: 'aut', name: 'Austria GP', flag: '🇦🇹', aeroWeight: 0.30, engineWeight: 0.42, driverWeight: 0.28, baseRainChance: 0.20 },
  { id: 'gbr', name: 'Silverstone GP', flag: '🇬🇧', aeroWeight: 0.40, engineWeight: 0.35, driverWeight: 0.25, baseRainChance: 0.30 },
  { id: 'hun', name: 'Hungary GP', flag: '🇭🇺', aeroWeight: 0.48, engineWeight: 0.20, driverWeight: 0.32, baseRainChance: 0.25 },
  { id: 'bel', name: 'Belgium GP', flag: '🇧🇪', aeroWeight: 0.32, engineWeight: 0.40, driverWeight: 0.28, baseRainChance: 0.45 },
  { id: 'ned', name: 'Netherlands GP', flag: '🇳🇱', aeroWeight: 0.42, engineWeight: 0.28, driverWeight: 0.30, baseRainChance: 0.30 },
  { id: 'ita', name: 'Monza GP', flag: '🇮🇹', aeroWeight: 0.15, engineWeight: 0.60, driverWeight: 0.25, baseRainChance: 0.05 },
  { id: 'aze', name: 'Azerbaijan GP', flag: '🇦🇿', aeroWeight: 0.22, engineWeight: 0.48, driverWeight: 0.30, baseRainChance: 0.05 },
  { id: 'sin', name: 'Singapore GP', flag: '🇸🇬', aeroWeight: 0.40, engineWeight: 0.25, driverWeight: 0.35, baseRainChance: 0.40 },
  { id: 'usa', name: 'United States GP', flag: '🇺🇸', aeroWeight: 0.38, engineWeight: 0.35, driverWeight: 0.27, baseRainChance: 0.15 },
  { id: 'mex', name: 'Mexico GP', flag: '🇲🇽', aeroWeight: 0.32, engineWeight: 0.40, driverWeight: 0.28, baseRainChance: 0.10 },
  { id: 'bra', name: 'Brazil GP', flag: '🇧🇷', aeroWeight: 0.38, engineWeight: 0.32, driverWeight: 0.30, baseRainChance: 0.40 },
  { id: 'lv', name: 'Las Vegas GP', flag: '🇺🇸', aeroWeight: 0.20, engineWeight: 0.52, driverWeight: 0.28, baseRainChance: 0.05 },
  { id: 'qat', name: 'Qatar GP', flag: '🇶🇦', aeroWeight: 0.36, engineWeight: 0.36, driverWeight: 0.28, baseRainChance: 0.05 },
  { id: 'abu', name: 'Abu Dhabi GP', flag: '🇦🇪', aeroWeight: 0.34, engineWeight: 0.38, driverWeight: 0.28, baseRainChance: 0.02 },
];

/** Short championship so a result arrives before the season feels endless. */
export const SEASON_LENGTH = 10;
export const SEASON_CALENDAR = CALENDAR_24.slice(0, SEASON_LENGTH);

/** Chassis packages — aero / eng / rel */
export const CONSTRUCTORS = [
  { id: 'fer_04', name: 'Ferrari F2004', year: 2004, color: '#E10600', aero: 98, eng: 97, rel: 98 },
  { id: 'fer_02', name: 'Ferrari F2002', year: 2002, color: '#E10600', aero: 96, eng: 95, rel: 94 },
  { id: 'fer_00', name: 'Ferrari F1-2000', year: 2000, color: '#E10600', aero: 92, eng: 93, rel: 90 },
  { id: 'fer_77', name: 'Ferrari 312T2', year: 1977, color: '#E10600', aero: 88, eng: 90, rel: 78 },
  { id: 'fer_79', name: 'Ferrari 312T4', year: 1979, color: '#E10600', aero: 89, eng: 88, rel: 80 },
  { id: 'fer_21', name: 'Ferrari SF21', year: 2021, color: '#E10600', aero: 86, eng: 92, rel: 84 },
  { id: 'fer_22', name: 'Ferrari F1-75', year: 2022, color: '#E10600', aero: 93, eng: 91, rel: 82 },
  { id: 'fer_24', name: 'Ferrari SF-24', year: 2024, color: '#E10600', aero: 91, eng: 92, rel: 86 },
  { id: 'mcl_88', name: 'McLaren MP4/4', year: 1988, color: '#FF8700', aero: 99, eng: 99, rel: 92 },
  { id: 'mcl_89', name: 'McLaren MP4/5', year: 1989, color: '#FF8700', aero: 95, eng: 96, rel: 90 },
  { id: 'mcl_98', name: 'McLaren MP4/13', year: 1998, color: '#FF8700', aero: 95, eng: 91, rel: 89 },
  { id: 'mcl_08', name: 'McLaren MP4-23', year: 2008, color: '#FF8700', aero: 92, eng: 91, rel: 88 },
  { id: 'mcl_21', name: 'McLaren MCL35M', year: 2021, color: '#FF8700', aero: 84, eng: 86, rel: 88 },
  { id: 'mcl_24', name: 'McLaren MCL38', year: 2024, color: '#FF8700', aero: 98, eng: 94, rel: 95 },
  { id: 'wil_92', name: 'Williams FW14B', year: 1992, color: '#00A0DE', aero: 98, eng: 93, rel: 91 },
  { id: 'wil_96', name: 'Williams FW18', year: 1996, color: '#00A0DE', aero: 96, eng: 94, rel: 90 },
  { id: 'wil_97', name: 'Williams FW19', year: 1997, color: '#00A0DE', aero: 94, eng: 92, rel: 88 },
  { id: 'wil_03', name: 'Williams FW25', year: 2003, color: '#00A0DE', aero: 86, eng: 89, rel: 82 },
  { id: 'wil_21', name: 'Williams FW43B', year: 2021, color: '#00A0DE', aero: 68, eng: 80, rel: 78 },
  { id: 'rbr_10', name: 'Red Bull RB6', year: 2010, color: '#1E41FF', aero: 94, eng: 88, rel: 90 },
  { id: 'rbr_11', name: 'Red Bull RB7', year: 2011, color: '#1E41FF', aero: 97, eng: 89, rel: 92 },
  { id: 'rbr_13', name: 'Red Bull RB9', year: 2013, color: '#1E41FF', aero: 98, eng: 90, rel: 93 },
  { id: 'rbr_21', name: 'Red Bull RB16B', year: 2021, color: '#1E41FF', aero: 95, eng: 92, rel: 91 },
  { id: 'rbr_22', name: 'Red Bull RB18', year: 2022, color: '#1E41FF', aero: 98, eng: 95, rel: 96 },
  { id: 'rbr_23', name: 'Red Bull RB19', year: 2023, color: '#1E41FF', aero: 99, eng: 96, rel: 99 },
  { id: 'mer_14', name: 'Mercedes W05', year: 2014, color: '#00D2BE', aero: 94, eng: 99, rel: 95 },
  { id: 'mer_15', name: 'Mercedes W06', year: 2015, color: '#00D2BE', aero: 96, eng: 99, rel: 96 },
  { id: 'mer_16', name: 'Mercedes W07', year: 2016, color: '#00D2BE', aero: 96, eng: 99, rel: 94 },
  { id: 'mer_19', name: 'Mercedes W10', year: 2019, color: '#00D2BE', aero: 96, eng: 97, rel: 94 },
  { id: 'mer_20', name: 'Mercedes W11', year: 2020, color: '#00D2BE', aero: 98, eng: 97, rel: 96 },
  { id: 'mer_21', name: 'Mercedes W12', year: 2021, color: '#00D2BE', aero: 95, eng: 95, rel: 93 },
  { id: 'mer_22', name: 'Mercedes W13', year: 2022, color: '#00D2BE', aero: 82, eng: 91, rel: 85 },
  { id: 'lot_78', name: 'Lotus 79', year: 1978, color: '#000000', aero: 94, eng: 85, rel: 72 },
  { id: 'lot_85', name: 'Lotus 97T', year: 1985, color: '#FFD700', aero: 88, eng: 91, rel: 75 },
  { id: 'bra_09', name: 'Brawn BGP 001', year: 2009, color: '#FFFFFF', aero: 96, eng: 88, rel: 94 },
  { id: 'ren_05', name: 'Renault R25', year: 2005, color: '#FFCC00', aero: 92, eng: 89, rel: 88 },
  { id: 'ren_06', name: 'Renault R26', year: 2006, color: '#FFCC00', aero: 93, eng: 90, rel: 89 },
  { id: 'ben_95', name: 'Benetton B195', year: 1995, color: '#00A651', aero: 91, eng: 92, rel: 86 },
  { id: 'tyr_90', name: 'Tyrrell 019', year: 1990, color: '#0000FF', aero: 72, eng: 74, rel: 70 },
  { id: 'arr_97', name: 'Arrows A18', year: 1997, color: '#FF6600', aero: 70, eng: 76, rel: 65 },
  { id: 'min_85', name: 'Minardi M185', year: 1985, color: '#FFD700', aero: 58, eng: 62, rel: 60 },
  { id: 'sau_82', name: 'March 821', year: 1982, color: '#FFFFFF', aero: 68, eng: 70, rel: 62 },
  { id: 'jor_99', name: 'Jordan 199', year: 1999, color: '#FFD700', aero: 83, eng: 85, rel: 79 },
  { id: 'bar_04', name: 'BAR 006', year: 2004, color: '#FFFFFF', aero: 85, eng: 87, rel: 81 },
  { id: 'toy_05', name: 'Toyota TF105', year: 2005, color: '#EB0A1E', aero: 80, eng: 86, rel: 83 },
  { id: 'sai_09', name: 'BMW Sauber C28', year: 2009, color: '#C0C0C0', aero: 74, eng: 78, rel: 80 },
  { id: 'alp_21', name: 'Alpine A521', year: 2021, color: '#0090FF', aero: 80, eng: 82, rel: 78 },
  { id: 'ast_23', name: 'Aston Martin AMR23', year: 2023, color: '#006F62', aero: 86, eng: 89, rel: 87 },
  { id: 'has_18', name: 'Haas VF-18', year: 2018, color: '#FFFFFF', aero: 76, eng: 85, rel: 72 },
  { id: 'atr_23', name: 'AlphaTauri AT04', year: 2023, color: '#2B4562', aero: 78, eng: 89, rel: 84 },
  { id: 'alf_20', name: 'Alfa Romeo C39', year: 2020, color: '#9B0000', aero: 75, eng: 83, rel: 80 },
  { id: 'tor_08', name: 'Toro Rosso STR3', year: 2008, color: '#0000FF', aero: 79, eng: 83, rel: 81 },
  { id: 'bmw_08', name: 'BMW Sauber F1.08', year: 2008, color: '#FFFFFF', aero: 87, eng: 89, rel: 86 },
  { id: 'hon_88', name: 'Honda RA168E*', year: 1988, color: '#FFFFFF', aero: 86, eng: 97, rel: 88 },
  { id: 'bra_76', name: 'Ferrari 312T2', year: 1976, color: '#E10600', aero: 87, eng: 90, rel: 76 },
  { id: 'mcl_91', name: 'McLaren MP4/6', year: 1991, color: '#FF8700', aero: 91, eng: 93, rel: 87 },
  { id: 'wil_86', name: 'Williams FW11', year: 1986, color: '#00A0DE', aero: 92, eng: 94, rel: 83 },
];

/** Team principals — tac (tactics) / rnd (R&D) */
export const PRINCIPALS = [
  { id: 'jt_04', name: 'Jean Todt', year: 2004, era: 'Ferrari Peak', team: 'Ferrari', tac: 98, rnd: 95 },
  { id: 'jt_00', name: 'Jean Todt', year: 2000, era: 'Ferrari Ascend', team: 'Ferrari', tac: 96, rnd: 94 },
  { id: 'briatore_05', name: 'Flavio Briatore', year: 2005, era: 'Renault Peak', team: 'Renault', tac: 90, rnd: 88 },
  { id: 'horner_13', name: 'Christian Horner', year: 2013, era: 'Red Bull Peak', team: 'Red Bull', tac: 95, rnd: 96 },
  { id: 'horner_23', name: 'Christian Horner', year: 2023, era: 'RB19 Era', team: 'Red Bull', tac: 96, rnd: 97 },
  { id: 'wolff_20', name: 'Toto Wolff', year: 2020, era: 'Mercedes Peak', team: 'Mercedes', tac: 97, rnd: 96 },
  { id: 'wolff_15', name: 'Toto Wolff', year: 2015, era: 'Hybrid Dawn', team: 'Mercedes', tac: 95, rnd: 97 },
  { id: 'dennis_98', name: 'Ron Dennis', year: 1998, era: 'McLaren Peak', team: 'McLaren', tac: 93, rnd: 92 },
  { id: 'dennis_88', name: 'Ron Dennis', year: 1988, era: 'MP4/4', team: 'McLaren', tac: 94, rnd: 93 },
  { id: 'williams_92', name: 'Frank Williams', year: 1992, era: 'FW14B', team: 'Williams', tac: 92, rnd: 94 },
  { id: 'stella_24', name: 'Andrea Stella', year: 2024, era: 'McLaren Revival', team: 'McLaren', tac: 93, rnd: 95 },
  { id: 'vasseur_24', name: 'Frédéric Vasseur', year: 2024, era: 'Ferrari Rebuild', team: 'Ferrari', tac: 90, rnd: 89 },
  { id: 'brown_09', name: 'Ross Brawn', year: 2009, era: 'Brawn Miracle', team: 'Brawn GP', tac: 99, rnd: 94 },
  { id: 'brown_04', name: 'Ross Brawn', year: 2004, era: 'Ferrari Peak', team: 'Ferrari', tac: 98, rnd: 96 },
  { id: 'newey_92', name: 'Adrian Newey*', year: 1992, era: 'Design God', team: 'Williams', tac: 88, rnd: 99 },
  { id: 'newey_13', name: 'Adrian Newey*', year: 2013, era: 'Design God', team: 'Red Bull', tac: 90, rnd: 99 },
  { id: 'capito_21', name: 'Jost Capito', year: 2021, era: 'Williams Rebuild', team: 'Williams', tac: 78, rnd: 80 },
  { id: 'seidl_21', name: 'Andreas Seidl', year: 2021, era: 'McLaren Climb', team: 'McLaren', tac: 88, rnd: 87 },
  { id: 'mateschitz_10', name: 'Dietrich Mateschitz', year: 2010, era: 'Energy Drink Era', team: 'Red Bull', tac: 85, rnd: 90 },
  { id: 'ecclestone_70', name: 'Bernie Ecclestone', year: 1970, era: 'Brabham Years', team: 'Brabham', tac: 88, rnd: 82 },
];

/**
 * Draft unlocks: constructor id → season roster
 * Attributes: pac, rac, wet, con (50–99, wet can hit 100 for legends)
 */
export const TEAM_ROSTERS = {
  fer_04: [
    { id: 'ms_2004', name: 'Michael Schumacher', year: 2004, pac: 98, rac: 97, wet: 99, con: 97 },
    { id: 'rb_2004', name: 'Rubens Barrichello', year: 2004, pac: 88, rac: 86, wet: 84, con: 90 },
  ],
  fer_02: [
    { id: 'ms_2002', name: 'Michael Schumacher', year: 2002, pac: 97, rac: 97, wet: 99, con: 96 },
    { id: 'rb_2002', name: 'Rubens Barrichello', year: 2002, pac: 86, rac: 84, wet: 82, con: 88 },
  ],
  fer_00: [
    { id: 'ms_2000', name: 'Michael Schumacher', year: 2000, pac: 96, rac: 96, wet: 98, con: 94 },
    { id: 'rb_2000', name: 'Rubens Barrichello', year: 2000, pac: 85, rac: 84, wet: 80, con: 86 },
  ],
  fer_77: [
    { id: 'nl_1977', name: 'Niki Lauda', year: 1977, pac: 94, rac: 93, wet: 90, con: 95 },
    { id: 'cr_1977', name: 'Carlos Reutemann', year: 1977, pac: 88, rac: 87, wet: 85, con: 87 },
  ],
  fer_79: [
    { id: 'js_1979', name: 'Jody Scheckter', year: 1979, pac: 90, rac: 88, wet: 86, con: 89 },
    { id: 'gv_1979', name: 'Gilles Villeneuve', year: 1979, pac: 93, rac: 95, wet: 94, con: 78 },
  ],
  fer_21: [
    { id: 'cl_2021', name: 'Charles Leclerc', year: 2021, pac: 92, rac: 90, wet: 88, con: 86 },
    { id: 'cs_2021', name: 'Carlos Sainz', year: 2021, pac: 88, rac: 91, wet: 86, con: 90 },
  ],
  fer_22: [
    { id: 'cl_2022', name: 'Charles Leclerc', year: 2022, pac: 94, rac: 91, wet: 89, con: 84 },
    { id: 'cs_2022', name: 'Carlos Sainz', year: 2022, pac: 90, rac: 92, wet: 87, con: 91 },
  ],
  fer_24: [
    { id: 'cl_2024', name: 'Charles Leclerc', year: 2024, pac: 93, rac: 91, wet: 90, con: 88 },
    { id: 'cs_2024', name: 'Carlos Sainz', year: 2024, pac: 90, rac: 92, wet: 88, con: 92 },
  ],
  mcl_88: [
    { id: 'as_1988', name: 'Ayrton Senna', year: 1988, pac: 99, rac: 97, wet: 100, con: 92 },
    { id: 'ap_1988', name: 'Alain Prost', year: 1988, pac: 96, rac: 95, wet: 92, con: 97 },
  ],
  mcl_89: [
    { id: 'as_1989', name: 'Ayrton Senna', year: 1989, pac: 98, rac: 97, wet: 100, con: 91 },
    { id: 'ap_1989', name: 'Alain Prost', year: 1989, pac: 95, rac: 96, wet: 91, con: 96 },
  ],
  mcl_98: [
    { id: 'mh_1998', name: 'Mika Häkkinen', year: 1998, pac: 95, rac: 92, wet: 90, con: 94 },
    { id: 'dc_1998', name: 'David Coulthard', year: 1998, pac: 88, rac: 86, wet: 84, con: 89 },
  ],
  mcl_08: [
    { id: 'lh_2008', name: 'Lewis Hamilton', year: 2008, pac: 94, rac: 94, wet: 95, con: 90 },
    { id: 'hk_2008', name: 'Heikki Kovalainen', year: 2008, pac: 84, rac: 82, wet: 80, con: 85 },
  ],
  mcl_21: [
    { id: 'ln_2021', name: 'Lando Norris', year: 2021, pac: 88, rac: 87, wet: 86, con: 89 },
    { id: 'dr_2021', name: 'Daniel Ricciardo', year: 2021, pac: 85, rac: 90, wet: 88, con: 84 },
  ],
  mcl_24: [
    { id: 'ln_2024', name: 'Lando Norris', year: 2024, pac: 95, rac: 92, wet: 91, con: 92 },
    { id: 'op_2024', name: 'Oscar Piastri', year: 2024, pac: 92, rac: 90, wet: 88, con: 91 },
  ],
  wil_92: [
    { id: 'nm_1992', name: 'Nigel Mansell', year: 1992, pac: 95, rac: 93, wet: 88, con: 90 },
    { id: 'rp_1992', name: 'Riccardo Patrese', year: 1992, pac: 88, rac: 86, wet: 84, con: 89 },
  ],
  wil_96: [
    { id: 'dh_1996', name: 'Damon Hill', year: 1996, pac: 91, rac: 88, wet: 86, con: 92 },
    { id: 'jv_1996', name: 'Jacques Villeneuve', year: 1996, pac: 90, rac: 91, wet: 85, con: 88 },
  ],
  wil_97: [
    { id: 'jv_1997', name: 'Jacques Villeneuve', year: 1997, pac: 91, rac: 92, wet: 86, con: 89 },
    { id: 'hhf_1997', name: 'Heinz-Harald Frentzen', year: 1997, pac: 87, rac: 85, wet: 84, con: 88 },
  ],
  wil_03: [
    { id: 'jpm_2003', name: 'Juan Pablo Montoya', year: 2003, pac: 91, rac: 93, wet: 86, con: 82 },
    { id: 'rs_2003', name: 'Ralf Schumacher', year: 2003, pac: 86, rac: 84, wet: 82, con: 85 },
  ],
  wil_21: [
    { id: 'gr_2021', name: 'George Russell', year: 2021, pac: 89, rac: 88, wet: 86, con: 91 },
    { id: 'nl_2021', name: 'Nicholas Latifi', year: 2021, pac: 72, rac: 70, wet: 70, con: 78 },
  ],
  rbr_10: [
    { id: 'sv_2010', name: 'Sebastian Vettel', year: 2010, pac: 94, rac: 90, wet: 88, con: 91 },
    { id: 'mw_2010', name: 'Mark Webber', year: 2010, pac: 89, rac: 91, wet: 90, con: 90 },
  ],
  rbr_11: [
    { id: 'sv_2011', name: 'Sebastian Vettel', year: 2011, pac: 96, rac: 91, wet: 90, con: 94 },
    { id: 'mw_2011', name: 'Mark Webber', year: 2011, pac: 88, rac: 90, wet: 89, con: 89 },
  ],
  rbr_13: [
    { id: 'sv_2013', name: 'Sebastian Vettel', year: 2013, pac: 97, rac: 92, wet: 91, con: 95 },
    { id: 'mw_2013', name: 'Mark Webber', year: 2013, pac: 87, rac: 89, wet: 88, con: 88 },
  ],
  rbr_21: [
    { id: 'mv_2021', name: 'Max Verstappen', year: 2021, pac: 97, rac: 96, wet: 95, con: 94 },
    { id: 'sp_2021', name: 'Sergio Pérez', year: 2021, pac: 87, rac: 90, wet: 85, con: 88 },
  ],
  rbr_22: [
    { id: 'mv_2022', name: 'Max Verstappen', year: 2022, pac: 98, rac: 95, wet: 96, con: 96 },
    { id: 'sp_2022', name: 'Sergio Pérez', year: 2022, pac: 88, rac: 91, wet: 86, con: 89 },
  ],
  rbr_23: [
    { id: 'mv_2023', name: 'Max Verstappen', year: 2023, pac: 98, rac: 94, wet: 97, con: 97 },
    { id: 'sp_2023', name: 'Sergio Pérez', year: 2023, pac: 87, rac: 89, wet: 85, con: 88 },
  ],
  mer_14: [
    { id: 'lh_2014', name: 'Lewis Hamilton', year: 2014, pac: 96, rac: 94, wet: 97, con: 95 },
    { id: 'nr_2014', name: 'Nico Rosberg', year: 2014, pac: 92, rac: 90, wet: 88, con: 93 },
  ],
  mer_15: [
    { id: 'lh_2015', name: 'Lewis Hamilton', year: 2015, pac: 97, rac: 95, wet: 98, con: 96 },
    { id: 'nr_2015', name: 'Nico Rosberg', year: 2015, pac: 93, rac: 91, wet: 89, con: 94 },
  ],
  mer_16: [
    { id: 'nr_2016', name: 'Nico Rosberg', year: 2016, pac: 94, rac: 92, wet: 90, con: 95 },
    { id: 'lh_2016', name: 'Lewis Hamilton', year: 2016, pac: 97, rac: 95, wet: 98, con: 94 },
  ],
  mer_19: [
    { id: 'lh_2019', name: 'Lewis Hamilton', year: 2019, pac: 97, rac: 95, wet: 98, con: 96 },
    { id: 'vb_2019', name: 'Valtteri Bottas', year: 2019, pac: 89, rac: 86, wet: 85, con: 91 },
  ],
  mer_20: [
    { id: 'lh_2020', name: 'Lewis Hamilton', year: 2020, pac: 98, rac: 95, wet: 98, con: 97 },
    { id: 'vb_2020', name: 'Valtteri Bottas', year: 2020, pac: 88, rac: 85, wet: 84, con: 90 },
  ],
  mer_21: [
    { id: 'lh_2021', name: 'Lewis Hamilton', year: 2021, pac: 97, rac: 96, wet: 98, con: 96 },
    { id: 'vb_2021', name: 'Valtteri Bottas', year: 2021, pac: 87, rac: 84, wet: 84, con: 89 },
  ],
  mer_22: [
    { id: 'lh_2022', name: 'Lewis Hamilton', year: 2022, pac: 94, rac: 94, wet: 97, con: 93 },
    { id: 'gr_2022', name: 'George Russell', year: 2022, pac: 91, rac: 90, wet: 88, con: 92 },
  ],
  lot_78: [
    { id: 'ma_1978', name: 'Mario Andretti', year: 1978, pac: 93, rac: 92, wet: 88, con: 90 },
    { id: 'rp_1978', name: 'Ronnie Peterson', year: 1978, pac: 92, rac: 93, wet: 90, con: 85 },
  ],
  lot_85: [
    { id: 'as_1985', name: 'Ayrton Senna', year: 1985, pac: 96, rac: 95, wet: 99, con: 88 },
    { id: 'eda_1985', name: 'Elio de Angelis', year: 1985, pac: 86, rac: 85, wet: 82, con: 87 },
  ],
  bra_09: [
    { id: 'jb_2009', name: 'Jenson Button', year: 2009, pac: 91, rac: 90, wet: 94, con: 93 },
    { id: 'rb_2009', name: 'Rubens Barrichello', year: 2009, pac: 86, rac: 85, wet: 84, con: 88 },
  ],
  ren_05: [
    { id: 'fa_2005', name: 'Fernando Alonso', year: 2005, pac: 95, rac: 97, wet: 94, con: 94 },
    { id: 'gf_2005', name: 'Giancarlo Fisichella', year: 2005, pac: 86, rac: 85, wet: 84, con: 87 },
  ],
  ren_06: [
    { id: 'fa_2006', name: 'Fernando Alonso', year: 2006, pac: 95, rac: 98, wet: 94, con: 94 },
    { id: 'gf_2006', name: 'Giancarlo Fisichella', year: 2006, pac: 85, rac: 84, wet: 83, con: 86 },
  ],
  ben_95: [
    { id: 'ms_1995', name: 'Michael Schumacher', year: 1995, pac: 96, rac: 97, wet: 98, con: 93 },
    { id: 'jh_1995', name: 'Johnny Herbert', year: 1995, pac: 84, rac: 82, wet: 80, con: 85 },
  ],
  tyr_90: [
    { id: 'ja_1990', name: 'Jean Alesi', year: 1990, pac: 88, rac: 92, wet: 90, con: 80 },
    { id: 'sn_1990', name: 'Satoru Nakajima', year: 1990, pac: 78, rac: 76, wet: 74, con: 80 },
  ],
  arr_97: [
    { id: 'dh_1997', name: 'Damon Hill', year: 1997, pac: 88, rac: 86, wet: 84, con: 86 },
    { id: 'pd_1997', name: 'Pedro Diniz', year: 1997, pac: 74, rac: 72, wet: 72, con: 78 },
  ],
  min_85: [
    { id: 'pm_1985', name: 'Pierluigi Martini', year: 1985, pac: 72, rac: 70, wet: 70, con: 75 },
    { id: 'adc_1985', name: 'Andrea de Cesaris', year: 1985, pac: 76, rac: 78, wet: 74, con: 68 },
  ],
  sau_82: [
    { id: 'jm_1982', name: 'Jochen Mass', year: 1982, pac: 78, rac: 76, wet: 76, con: 80 },
    { id: 'rbo_1982', name: 'Raul Boesel', year: 1982, pac: 72, rac: 70, wet: 70, con: 74 },
  ],
  jor_99: [
    { id: 'hhf_1999', name: 'Heinz-Harald Frentzen', year: 1999, pac: 88, rac: 86, wet: 85, con: 87 },
    { id: 'dh_1999', name: 'Damon Hill', year: 1999, pac: 84, rac: 82, wet: 82, con: 85 },
  ],
  bar_04: [
    { id: 'jb_2004', name: 'Jenson Button', year: 2004, pac: 88, rac: 87, wet: 90, con: 89 },
    { id: 'ts_2004', name: 'Takuma Sato', year: 2004, pac: 82, rac: 84, wet: 80, con: 78 },
  ],
  toy_05: [
    { id: 'jt_2005', name: 'Jarno Trulli', year: 2005, pac: 85, rac: 82, wet: 82, con: 86 },
    { id: 'rs_2005', name: 'Ralf Schumacher', year: 2005, pac: 84, rac: 83, wet: 80, con: 84 },
  ],
  sai_09: [
    { id: 'kk_2009', name: 'Kamui Kobayashi', year: 2009, pac: 82, rac: 88, wet: 84, con: 78 },
    { id: 'gf_2009', name: 'Giancarlo Fisichella', year: 2009, pac: 83, rac: 82, wet: 82, con: 85 },
  ],
  alp_21: [
    { id: 'fa_2021', name: 'Fernando Alonso', year: 2021, pac: 90, rac: 97, wet: 94, con: 91 },
    { id: 'eo_2021', name: 'Esteban Ocon', year: 2021, pac: 84, rac: 85, wet: 82, con: 86 },
  ],
  ast_23: [
    { id: 'fa_2023', name: 'Fernando Alonso', year: 2023, pac: 91, rac: 98, wet: 95, con: 92 },
    { id: 'ls_2023', name: 'Lance Stroll', year: 2023, pac: 80, rac: 78, wet: 78, con: 82 },
  ],
  has_18: [
    { id: 'rg_2018', name: 'Romain Grosjean', year: 2018, pac: 84, rac: 86, wet: 82, con: 76 },
    { id: 'km_2018', name: 'Kevin Magnussen', year: 2018, pac: 83, rac: 85, wet: 80, con: 82 },
  ],
  atr_23: [
    { id: 'yt_2023', name: 'Yuki Tsunoda', year: 2023, pac: 84, rac: 86, wet: 82, con: 83 },
    { id: 'dr_2023', name: 'Daniel Ricciardo', year: 2023, pac: 85, rac: 88, wet: 86, con: 84 },
  ],
  alf_20: [
    { id: 'kr_2020', name: 'Kimi Räikkönen', year: 2020, pac: 84, rac: 88, wet: 90, con: 86 },
    { id: 'ag_2020', name: 'Antonio Giovinazzi', year: 2020, pac: 78, rac: 76, wet: 76, con: 80 },
  ],
  tor_08: [
    { id: 'sv_2008', name: 'Sebastian Vettel', year: 2008, pac: 90, rac: 88, wet: 86, con: 88 },
    { id: 'sb_2008', name: 'Sébastien Bourdais', year: 2008, pac: 80, rac: 82, wet: 78, con: 82 },
  ],
  bmw_08: [
    { id: 'rk_2008', name: 'Robert Kubica', year: 2008, pac: 91, rac: 93, wet: 92, con: 90 },
    { id: 'nh_2008', name: 'Nick Heidfeld', year: 2008, pac: 86, rac: 85, wet: 90, con: 89 },
  ],
  hon_88: [
    { id: 'sn_1988', name: 'Satoru Nakajima', year: 1988, pac: 76, rac: 74, wet: 72, con: 78 },
  ],
  bra_76: [
    { id: 'nl_1976', name: 'Niki Lauda', year: 1976, pac: 95, rac: 94, wet: 90, con: 95 },
    { id: 'cre_1976', name: 'Clay Regazzoni', year: 1976, pac: 86, rac: 88, wet: 84, con: 85 },
  ],
  mcl_91: [
    { id: 'as_1991', name: 'Ayrton Senna', year: 1991, pac: 98, rac: 97, wet: 100, con: 93 },
    { id: 'gb_1991', name: 'Gerhard Berger', year: 1991, pac: 89, rac: 90, wet: 86, con: 88 },
  ],
  wil_86: [
    { id: 'nm_1986', name: 'Nigel Mansell', year: 1986, pac: 93, rac: 94, wet: 86, con: 86 },
    { id: 'np_1986', name: 'Nelson Piquet', year: 1986, pac: 92, rac: 93, wet: 88, con: 91 },
  ],
};

/** Extra iconic drivers for AI multiverse mashups (not only roster-tied) */
export const EXTRA_DRIVERS = [
  { id: 'as_1993', name: 'Ayrton Senna', year: 1993, pac: 98, rac: 96, wet: 100, con: 90 },
  { id: 'lh_2018', name: 'Lewis Hamilton', year: 2018, pac: 96, rac: 95, wet: 98, con: 95 },
  { id: 'fa_2012', name: 'Fernando Alonso', year: 2012, pac: 94, rac: 99, wet: 96, con: 96 },
  { id: 'kr_2007', name: 'Kimi Räikkönen', year: 2007, pac: 94, rac: 90, wet: 93, con: 92 },
  { id: 'ms_2001', name: 'Michael Schumacher', year: 2001, pac: 97, rac: 96, wet: 99, con: 95 },
];

export function driverSkill(d) {
  const pac = d.pac ?? d.pace ?? 80;
  const rac = d.rac ?? 80;
  const wet = d.wet ?? 80;
  const con = d.con ?? d.consistency ?? 80;
  return Math.round((pac + rac + wet + con) / 4);
}

export function getAllDrivers() {
  const seen = new Set();
  const list = [];
  const push = (d) => {
    const key = d.id || `${d.name}_${d.year}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      ...d,
      year: d.year ?? Number(d.era) ?? 2000,
      driver_skill: driverSkill(d),
      era: String(d.year ?? d.era ?? ''),
    });
  };
  for (const roster of Object.values(TEAM_ROSTERS)) {
    for (const d of roster) push(d);
  }
  for (const d of EXTRA_DRIVERS) push(d);
  return list;
}

export function getRosterForConstructor(constructorId) {
  return TEAM_ROSTERS[constructorId] || [];
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random int inclusive */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/** Track profile labels for pre-race strategy UI */
/** Top-tier drivers for Boss Competitor grid slots */
export function getEliteDrivers() {
  return getAllDrivers().filter((d) => driverSkill(d) >= 92 || d.pac >= 94);
}

/** Historically dominant chassis for Boss Competitor pairings */
export function getEliteConstructors() {
  return CONSTRUCTORS.filter((c) => (c.aero + c.eng + c.rel) / 3 >= 91);
}

export function getTrackProfile(track) {
  const { aeroWeight: aw, engineWeight: ew, driverWeight: dw, baseRainChance } = track;
  let archetype = 'Balanced';
  let desc = 'Mixed corners and straights — setup compromise matters.';
  const traits = [];

  if (aw >= 0.5) {
    archetype = 'High Downforce';
    desc = 'Tight, technical layout — aero and precision dominate.';
    traits.push('Low-speed grip', 'Qualifying critical');
  } else if (ew >= 0.5) {
    archetype = 'High Speed';
    desc = 'Long straights and heavy braking — engine power pays.';
    traits.push('Top speed', 'Low drag setups');
  } else if (dw >= 0.33) {
    archetype = 'Driver Circuit';
    desc = 'Unforgiving rhythm — mistakes are punished.';
    traits.push('High commitment', 'Consistency key');
  }

  if (baseRainChance >= 0.35) traits.push('Rain threat');
  if (track.id === 'mon') {
    return {
      archetype: 'High Downforce',
      desc: 'Monaco — narrow walls, zero margin. Aero is king.',
      traits: ['Ultra-low speed', 'No overtaking', 'Wall proximity'],
      aeroBias: 'High',
      engineBias: 'Low',
    };
  }
  if (track.id === 'ita') {
    return {
      archetype: 'High Speed',
      desc: 'Monza — Temple of Speed. Minimum drag, maximum horsepower.',
      traits: ['Long straights', 'Low downforce', 'Slipstream battles'],
      aeroBias: 'Low',
      engineBias: 'Very High',
    };
  }

  return {
    archetype,
    desc,
    traits: traits.length ? traits : ['Mixed sector demands'],
    aeroBias: aw >= 0.42 ? 'High' : aw >= 0.32 ? 'Medium' : 'Low',
    engineBias: ew >= 0.45 ? 'High' : ew >= 0.35 ? 'Medium' : 'Low',
  };
}
