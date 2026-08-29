export const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

export const fitnessData = {
  today: {
    periodLabel: 'today',
    stats: {
      caloriesTaken: { value: 1480, goal: 2200, trend: '+4.2%', up: true, good: false, note: '62% of 2,200 kcal goal' },
      caloriesBurned: { value: 520, goal: 700, trend: '+12.8%', up: true, good: true, note: '74% of 700 kcal goal' },
      weight: { value: 72.4, unit: 'kg', trend: '-0.6', up: false, good: true, note: 'since yesterday' },
      distanceKm: { value: 6.2, unit: 'km', trend: '+1.4', up: true, good: true, note: '48 min active' },
    },
    heartRate: [
      { label: '6a', bpm: 61 }, { label: '7a', bpm: 138 }, { label: '8a', bpm: 122 },
      { label: '9a', bpm: 74 }, { label: '10a', bpm: 68 }, { label: '11a', bpm: 71 },
      { label: '12p', bpm: 78 }, { label: '1p', bpm: 70 }, { label: '2p', bpm: 66 },
      { label: '3p', bpm: 142 }, { label: '4p', bpm: 118 }, { label: '5p', bpm: 76 },
      { label: '6p', bpm: 69 }, { label: '7p', bpm: 73 }, { label: '8p', bpm: 65 },
      { label: '9p', bpm: 62 },
    ],
    hrSummary: { current: 64, resting: 58, max: 142, zone: 'Resting' },
    calorieIntake: [
      { label: 'Breakfast', kcal: 420 }, { label: 'Lunch', kcal: 580 },
      { label: 'Snack', kcal: 210 }, { label: 'Dinner', kcal: 270 },
    ],
    intakeTotal: 1480,
    sleep: {
      duration: '7h 24m',
      totalMin: 444,
      quality: 86,
      deep: '1h 38m',
      deepMin: 98,
      rem: '1h 12m',
      remMin: 72,
      awake: '14m',
      awakeMin: 14,
      window: '11:20 PM – 6:45 AM',
      trend: '+22m vs yesterday',
      good: true,
    },
    vo2max: {
      value: 48.6,
      unit: 'ml/kg/min',
      goal: 52,
      rating: 'Excellent',
      restingHr: 54,
      fitnessAge: 24,
      trend: '+1.2 vs last month',
      good: true,
    },
    bodyBattery: {
      level: 78,
      status: 'Energized',
      charged: '+35',
      drained: '-12',
      low: 42,
      high: 86,
      trend: 'Charging back up since this evening',
      good: true,
      series: [
        { label: '6a', battery: 86, stress: 16 },
        { label: '8a', battery: 80, stress: 35 },
        { label: '10a', battery: 66, stress: 54 },
        { label: '12p', battery: 52, stress: 62 },
        { label: '2p', battery: 44, stress: 22, rest: 100 },
        { label: '3p', battery: 50, stress: 14, rest: 100 },
        { label: '5p', battery: 58, stress: 33 },
        { label: '7p', battery: 68, stress: 28 },
        { label: 'Now', battery: 78, stress: 21 },
      ],
    },
  },
  week: {
    periodLabel: 'this week',
    stats: {
      caloriesTaken: { value: 9845, goal: 15400, trend: '+2.1%', up: true, good: false, note: 'avg 1,406 kcal / day' },
      caloriesBurned: { value: 3940, goal: 4900, trend: '+8.6%', up: true, good: true, note: 'avg 563 kcal / day' },
      weight: { value: 72.4, unit: 'kg', trend: '-1.2', up: false, good: true, note: 'since last week' },
      distanceKm: { value: 28.4, unit: 'km', trend: '+5.2', up: true, good: true, note: '4 runs logged' },
    },
    heartRate: [
      { label: 'Mon', bpm: 68 }, { label: 'Tue', bpm: 131 }, { label: 'Wed', bpm: 71 },
      { label: 'Thu', bpm: 127 }, { label: 'Fri', bpm: 66 }, { label: 'Sat', bpm: 145 },
      { label: 'Sun', bpm: 63 },
    ],
    hrSummary: { current: 66, resting: 57, max: 145, zone: 'Resting' },
    calorieIntake: [
      { label: 'Mon', kcal: 1350 }, { label: 'Tue', kcal: 1520 }, { label: 'Wed', kcal: 1290 },
      { label: 'Thu', kcal: 1610 }, { label: 'Fri', kcal: 1445 }, { label: 'Sat', kcal: 1780 },
      { label: 'Sun', kcal: 850 },
    ],
    intakeTotal: 9845,
    sleep: {
      duration: '7h 05m',
      totalMin: 425,
      quality: 84,
      deep: '1h 31m',
      deepMin: 91,
      rem: '1h 08m',
      remMin: 68,
      awake: '19m',
      awakeMin: 19,
      window: 'avg 11:10 PM – 6:20 AM',
      trend: '+0.4h vs last week',
      good: true,
    },
    vo2max: {
      value: 48.6,
      unit: 'ml/kg/min',
      goal: 52,
      rating: 'Excellent',
      restingHr: 55,
      fitnessAge: 24,
      trend: '+0.4 vs last week',
      good: true,
    },
    bodyBattery: {
      level: 74,
      status: 'Balanced',
      charged: '+268',
      drained: '-243',
      low: 31,
      high: 88,
      trend: 'avg 74 · best day Saturday',
      good: true,
      series: [
        { label: 'Mon', battery: 70, stress: 38 },
        { label: 'Tue', battery: 76, stress: 31 },
        { label: 'Wed', battery: 65, stress: 44 },
        { label: 'Thu', battery: 79, stress: 29 },
        { label: 'Fri', battery: 62, stress: 48 },
        { label: 'Sat', battery: 84, stress: 18, rest: 100 },
        { label: 'Sun', battery: 74, stress: 24, rest: 100 },
      ],
    },
  },
  month: {
    periodLabel: 'this month',
    stats: {
      caloriesTaken: { value: 41320, goal: 66000, trend: '-1.4%', up: false, good: true, note: 'avg 1,377 kcal / day' },
      caloriesBurned: { value: 15800, goal: 21000, trend: '+6.3%', up: true, good: true, note: 'avg 527 kcal / day' },
      weight: { value: 72.4, unit: 'kg', trend: '-3.4', up: false, good: true, note: 'since last month' },
      distanceKm: { value: 112.6, unit: 'km', trend: '+18.9', up: true, good: true, note: '16 runs logged' },
    },
    heartRate: [
      { label: 'W1', bpm: 92 }, { label: 'W2', bpm: 89 }, { label: 'W3', bpm: 87 }, { label: 'W4', bpm: 84 },
    ],
    hrSummary: { current: 66, resting: 56, max: 152, zone: 'Improving' },
    calorieIntake: [
      { label: 'W1', kcal: 10840 }, { label: 'W2', kcal: 10420 },
      { label: 'W3', kcal: 10150 }, { label: 'W4', kcal: 9910 },
    ],
    intakeTotal: 41320,
    sleep: {
      duration: '7h 18m',
      totalMin: 438,
      quality: 85,
      deep: '1h 35m',
      deepMin: 95,
      rem: '1h 10m',
      remMin: 70,
      awake: '17m',
      awakeMin: 17,
      window: 'avg 11:05 PM – 6:30 AM',
      trend: '+0.2h vs last month',
      good: true,
    },
    vo2max: {
      value: 47.9,
      unit: 'ml/kg/min',
      goal: 52,
      rating: 'Excellent',
      restingHr: 56,
      fitnessAge: 25,
      trend: '+1.9 vs last month',
      good: true,
    },
    bodyBattery: {
      level: 71,
      status: 'Balanced',
      charged: '+1150',
      drained: '-1128',
      low: 28,
      high: 90,
      trend: 'avg 71 · trending up 4 pts',
      good: true,
      series: [
        { label: 'W1', battery: 68, stress: 41 },
        { label: 'W2', battery: 71, stress: 37 },
        { label: 'W3', battery: 69, stress: 30, rest: 100 },
        { label: 'W4', battery: 75, stress: 26, rest: 100 },
      ],
    },
  },
  year: {
    periodLabel: 'this year',
    stats: {
      caloriesTaken: { value: 498300, goal: 792000, trend: '-3.8%', up: false, good: true, note: 'avg 1,365 kcal / day' },
      caloriesBurned: { value: 186400, goal: 252000, trend: '+9.4%', up: true, good: true, note: 'avg 511 kcal / day' },
      weight: { value: 72.4, unit: 'kg', trend: '-11.2', up: false, good: true, note: 'since January' },
      distanceKm: { value: 1248, unit: 'km', trend: '+212', up: true, good: true, note: '184 runs logged' },
    },
    heartRate: [
      { label: 'Jan', bpm: 96 }, { label: 'Feb', bpm: 94 }, { label: 'Mar', bpm: 91 },
      { label: 'Apr', bpm: 90 }, { label: 'May', bpm: 88 }, { label: 'Jun', bpm: 86 },
      { label: 'Jul', bpm: 85 }, { label: 'Aug', bpm: 84 },
    ],
    hrSummary: { current: 66, resting: 54, max: 158, zone: 'Excellent' },
    calorieIntake: [
      { label: 'Jan', kcal: 44200 }, { label: 'Feb', kcal: 41900 }, { label: 'Mar', kcal: 43100 },
      { label: 'Apr', kcal: 41500 }, { label: 'May', kcal: 40800 }, { label: 'Jun', kcal: 39600 },
      { label: 'Jul', kcal: 40200 }, { label: 'Aug', kcal: 38900 },
    ],
    intakeTotal: 330200,
    sleep: {
      duration: '7h 26m',
      totalMin: 446,
      quality: 87,
      deep: '1h 42m',
      deepMin: 102,
      rem: '1h 15m',
      remMin: 75,
      awake: '15m',
      awakeMin: 15,
      window: 'avg 11:00 PM – 6:30 AM',
      trend: '+0.8h vs last year',
      good: true,
    },
    vo2max: {
      value: 45.8,
      unit: 'ml/kg/min',
      goal: 52,
      rating: 'Good',
      restingHr: 58,
      fitnessAge: 27,
      trend: '+3.6 vs last year',
      good: true,
    },
    bodyBattery: {
      level: 69,
      status: 'Balanced',
      charged: '+13400',
      drained: '-13310',
      low: 22,
      high: 92,
      trend: 'avg 69 · up 11 pts vs last year',
      good: true,
      series: [
        { label: 'Jan', battery: 61, stress: 52 },
        { label: 'Feb', battery: 63, stress: 49 },
        { label: 'Mar', battery: 65, stress: 45 },
        { label: 'Apr', battery: 66, stress: 43 },
        { label: 'May', battery: 68, stress: 38 },
        { label: 'Jun', battery: 70, stress: 35 },
        { label: 'Jul', battery: 72, stress: 28, rest: 100 },
        { label: 'Aug', battery: 74, stress: 27, rest: 100 },
      ],
    },
  },
}

export const workouts = [
  { id: 1, date: 'Aug 25', type: 'Morning Run', distance: 6.2, duration: '32:15', pace: '5:12 /km', calories: 412, hr: 142 },
  { id: 2, date: 'Aug 23', type: 'Interval Training', distance: 8.0, duration: '41:02', pace: '5:08 /km', calories: 548, hr: 155 },
  { id: 3, date: 'Aug 21', type: 'Easy Recovery Run', distance: 4.5, duration: '27:40', pace: '6:09 /km', calories: 289, hr: 124 },
  { id: 4, date: 'Aug 19', type: 'Tempo Run', distance: 7.3, duration: '35:48', pace: '4:54 /km', calories: 496, hr: 158 },
  { id: 5, date: 'Aug 16', type: 'Long Run', distance: 12.1, duration: '68:30', pace: '5:40 /km', calories: 812, hr: 138 },
  { id: 6, date: 'Aug 14', type: 'Morning Run', distance: 5.8, duration: '30:52', pace: '5:19 /km', calories: 385, hr: 141 },
]

export const macros = {
  protein: { value: 152, goal: 160, unit: 'g' },
  carbs: { value: 122, goal: 250, unit: 'g' },
  fat: { value: 41, goal: 70, unit: 'g' },
  water: { value: 1.8, goal: 2.5, unit: 'L' },
}

export const foodLog = {
  date: 'Monday, Aug 25',
  calorieGoal: 2200,
  meals: [
    {
      id: 'breakfast',
      name: 'Breakfast',
      time: '7:45 AM',
      foods: [
        { id: 'f1', name: 'Greek yogurt with berries', portion: '200 g bowl', kcal: 186, protein: 18, carbs: 14, fat: 4, fiber: 2, sugar: 11 },
        { id: 'f2', name: 'Whole grain toast', portion: '2 slices', kcal: 156, protein: 7, carbs: 28, fat: 2, fiber: 4, sugar: 2 },
        { id: 'f3', name: 'Banana', portion: '1 medium', kcal: 76, protein: 1, carbs: 19, fat: 0, fiber: 2, sugar: 10 },
        { id: 'f4', name: 'Black coffee', portion: '250 ml', kcal: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
      ],
    },
    {
      id: 'lunch',
      name: 'Lunch',
      time: '12:30 PM',
      foods: [
        { id: 'f5', name: 'Grilled chicken breast', portion: '180 g', kcal: 297, protein: 55, carbs: 0, fat: 7, fiber: 0, sugar: 0 },
        { id: 'f6', name: 'Brown rice', portion: '150 g cooked', kcal: 168, protein: 4, carbs: 35, fat: 1, fiber: 2, sugar: 0 },
        { id: 'f7', name: 'Mixed salad with olive oil', portion: '1 bowl', kcal: 115, protein: 3, carbs: 8, fat: 8, fiber: 4, sugar: 3 },
      ],
    },
    {
      id: 'snack',
      name: 'Snack',
      time: '4:15 PM',
      foods: [
        { id: 'f8', name: 'Whey protein shake', portion: '1 scoop + water', kcal: 120, protein: 24, carbs: 3, fat: 1, fiber: 0, sugar: 1 },
        { id: 'f9', name: 'Almonds', portion: '15 g', kcal: 90, protein: 3, carbs: 3, fat: 8, fiber: 2, sugar: 0 },
      ],
    },
    {
      id: 'dinner',
      name: 'Dinner',
      time: '7:30 PM',
      foods: [
        { id: 'f10', name: 'Baked salmon', portion: '130 g fillet', kcal: 180, protein: 34, carbs: 0, fat: 8, fiber: 0, sugar: 0 },
        { id: 'f11', name: 'Roasted vegetables', portion: '200 g', kcal: 90, protein: 3, carbs: 12, fat: 2, fiber: 5, sugar: 6 },
      ],
    },
  ],
}

export const weightSeries = [
  { label: 'Jan', kg: 83.6 }, { label: 'Feb', kg: 82.4 }, { label: 'Mar', kg: 81.1 },
  { label: 'Apr', kg: 79.8 }, { label: 'May', kg: 78.2 }, { label: 'Jun', kg: 76.5 },
  { label: 'Jul', kg: 74.3 }, { label: 'Aug', kg: 72.4 },
]

export const runningStats = {
  streakWeeks: 12,
  longestStreakWeeks: 18,
  thisWeekKm: 6.2,
  weeklyGoalKm: 25,
  totalKm: 1248,
  totalRuns: 184,
  avgPace: '5:21',
  weekDays: [
    { day: 'M', ran: true },
    { day: 'T', ran: false },
    { day: 'W', ran: false },
    { day: 'T', ran: false },
    { day: 'F', ran: false },
    { day: 'S', ran: false },
    { day: 'S', ran: false },
  ],
}

export const weeklyDistance = [
  { label: 'Jul 7', km: 22.4 },
  { label: 'Jul 14', km: 28.1 },
  { label: 'Jul 21', km: 18.6 },
  { label: 'Jul 28', km: 31.2 },
  { label: 'Aug 4', km: 25.8 },
  { label: 'Aug 11', km: 29.4 },
  { label: 'Aug 18', km: 26.7 },
  { label: 'Aug 25', km: 6.2 },
]

export const paceTrend = [
  { label: 'Jul 7', pace: 5.62 },
  { label: 'Jul 14', pace: 5.48 },
  { label: 'Jul 21', pace: 5.71 },
  { label: 'Jul 28', pace: 5.35 },
  { label: 'Aug 4', pace: 5.42 },
  { label: 'Aug 11', pace: 5.28 },
  { label: 'Aug 18', pace: 5.22 },
  { label: 'Aug 25', pace: 5.2 },
]

export const personalRecords = [
  { label: 'Fastest 5K', value: '24:38', date: 'Aug 19' },
  { label: 'Longest Run', value: '21.1 km', date: 'Jul 28' },
  { label: 'Biggest Week', value: '52.3 km', date: 'Jul 28' },
]

export const insights = [
  {
    tone: 'good',
    title: 'Pace improving',
    text: 'Average pace is 7.5% faster than last month (5:21 vs 5:44 /km). Tempo work is paying off.',
  },
  {
    tone: 'info',
    title: 'Saturday long-run habit',
    text: '62% of your long runs land on Saturdays — your most consistent day of the week.',
  },
  {
    tone: 'warn',
    title: 'Recovery suggested',
    text: 'Body battery dipped to 42 mid-week while mileage rose 18%. Keep tomorrow easy.',
  },
]

export const progressStats = {
  startWeight: 83.6,
  currentWeight: 72.4,
  goalWeight: 70,
  heightCm: 178,
}

export const hydration = {
  todayMl: 1800,
  goalMl: 2500,
  glassMl: 250,
  week: [
    { label: 'Mon', ml: 2100 }, { label: 'Tue', ml: 2450 }, { label: 'Wed', ml: 1800 },
    { label: 'Thu', ml: 2600 }, { label: 'Fri', ml: 1500 }, { label: 'Sat', ml: 2300 },
    { label: 'Sun', ml: 1950 },
  ],
}

export const smokeFree = {
  quitDate: 'Jan 1, 2026',
  daysSmokeFree: 236,
  cigarettesPerDay: 15,
  costPerCigarette: 0.6,
}

export const dailyGoals = [
  { id: 'sweet-drinks', label: 'No sweet drinks', streak: 14, doneToday: true },
  { id: 'no-smoking', label: 'No smoking', streak: 236, doneToday: true },
  { id: 'water', label: 'Drink 2.5 L water', streak: 6, doneToday: false },
  { id: 'steps', label: '10,000 steps', streak: 21, doneToday: false },
  { id: 'sleep', label: 'Sleep by 11 PM', streak: 4, doneToday: false },
]
