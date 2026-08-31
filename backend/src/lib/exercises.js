/**
 * Gym exercise catalog — machines plus common free-weight/bodyweight movements.
 * Muscle keys match the <MuscleAnatomy/> SVG regions on the frontend; primary
 * muscles take the full training stimulus, secondary ones roughly half.
 */

export const RECOVERY_HOURS = 72

export const EXERCISES = [
  // chest
  { key: 'bench-press', label: 'Bench Press', category: 'Chest', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { key: 'incline-press', label: 'Incline Press', category: 'Chest', primary: ['chest', 'shoulders'], secondary: ['triceps'] },
  { key: 'chest-press-machine', label: 'Chest Press Machine', category: 'Chest', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { key: 'pec-deck', label: 'Pec Deck / Chest Fly', category: 'Chest', primary: ['chest'], secondary: [] },
  { key: 'push-up', label: 'Push-up', category: 'Chest', primary: ['chest'], secondary: ['triceps', 'shoulders', 'abs'] },
  { key: 'dips', label: 'Dips', category: 'Chest', primary: ['chest', 'triceps'], secondary: ['shoulders'] },
  // back
  { key: 'lat-pulldown', label: 'Lat Pulldown Machine', category: 'Back', primary: ['lats'], secondary: ['biceps'] },
  { key: 'pull-up', label: 'Pull-up / Assisted Pull-up', category: 'Back', primary: ['lats'], secondary: ['biceps', 'forearms'] },
  { key: 'seated-row', label: 'Seated Row Machine', category: 'Back', primary: ['lats', 'traps'], secondary: ['biceps'] },
  { key: 'dumbbell-row', label: 'Dumbbell / Barbell Row', category: 'Back', primary: ['lats'], secondary: ['biceps', 'traps', 'lowerback'] },
  { key: 'back-extension', label: 'Back Extension', category: 'Back', primary: ['lowerback'], secondary: ['glutes', 'hamstrings'] },
  { key: 'shrug', label: 'Shrugs', category: 'Back', primary: ['traps'], secondary: ['forearms'] },
  { key: 'deadlift', label: 'Deadlift', category: 'Back', primary: ['lowerback', 'glutes', 'hamstrings'], secondary: ['traps', 'forearms', 'quads'] },
  // shoulders
  { key: 'shoulder-press', label: 'Shoulder Press', category: 'Shoulders', primary: ['shoulders'], secondary: ['triceps'] },
  { key: 'lateral-raise', label: 'Lateral Raise', category: 'Shoulders', primary: ['shoulders'], secondary: [] },
  { key: 'face-pull', label: 'Face Pull', category: 'Shoulders', primary: ['shoulders', 'traps'], secondary: [] },
  // arms
  { key: 'bicep-curl', label: 'Bicep Curl', category: 'Arms', primary: ['biceps'], secondary: ['forearms'] },
  { key: 'hammer-curl', label: 'Hammer Curl', category: 'Arms', primary: ['biceps', 'forearms'], secondary: [] },
  { key: 'preacher-curl', label: 'Preacher Curl Machine', category: 'Arms', primary: ['biceps'], secondary: [] },
  { key: 'tricep-pushdown', label: 'Tricep Pushdown', category: 'Arms', primary: ['triceps'], secondary: [] },
  { key: 'overhead-extension', label: 'Overhead Tricep Extension', category: 'Arms', primary: ['triceps'], secondary: [] },
  { key: 'wrist-curl', label: 'Wrist Curl', category: 'Arms', primary: ['forearms'], secondary: [] },
  // legs
  { key: 'squat', label: 'Squat', category: 'Legs', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerback', 'abs'] },
  { key: 'leg-press', label: 'Leg Press Machine', category: 'Legs', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { key: 'leg-extension', label: 'Leg Extension Machine', category: 'Legs', primary: ['quads'], secondary: [] },
  { key: 'leg-curl', label: 'Leg Curl Machine', category: 'Legs', primary: ['hamstrings'], secondary: ['calves'] },
  { key: 'romanian-deadlift', label: 'Romanian Deadlift', category: 'Legs', primary: ['hamstrings', 'glutes'], secondary: ['lowerback', 'forearms'] },
  { key: 'hip-thrust', label: 'Hip Thrust', category: 'Legs', primary: ['glutes'], secondary: ['hamstrings'] },
  { key: 'lunge', label: 'Lunges', category: 'Legs', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'] },
  { key: 'calf-raise', label: 'Calf Raise', category: 'Legs', primary: ['calves'], secondary: [] },
  { key: 'hip-abduction', label: 'Hip Abduction Machine', category: 'Legs', primary: ['glutes'], secondary: [] },
  // core
  { key: 'crunch', label: 'Crunch / Ab Machine', category: 'Core', primary: ['abs'], secondary: [] },
  { key: 'plank', label: 'Plank', category: 'Core', primary: ['abs'], secondary: ['obliques', 'lowerback'] },
  { key: 'leg-raise', label: 'Hanging Leg Raise', category: 'Core', primary: ['abs'], secondary: ['obliques', 'forearms'] },
  { key: 'russian-twist', label: 'Russian Twist', category: 'Core', primary: ['obliques'], secondary: ['abs'] },
  { key: 'cable-woodchop', label: 'Cable Woodchop', category: 'Core', primary: ['obliques'], secondary: ['abs'] },
]

export const EXERCISE_MAP = new Map(EXERCISES.map((e) => [e.key, e]))
