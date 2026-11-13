// The question tree the tenant walks, and the fixes we show them before they send.
//
// This file decides what to ASK. It deliberately does not decide the priority — that is
// triage_decision() in the database, because the browser can be modified and a gas smell
// must never depend on what the client claims. Answer keys here match the keys that
// function reads, so adding a question that should affect urgency means changing both.

export interface Question {
  id: string;
  q: string;
  options: [value: string, label: string][];
  /** Only asked when the answers so far make it relevant. */
  showIf?: (a: Answers) => boolean;
}

export type Answers = Record<string, string>;

export interface Category {
  id: string;
  label: string;
  hint: string;
  /** Sent as work_orders.category, which staff already filter on. */
  category: string;
  questions: Question[];
}

export const CATEGORIES: Category[] = [
  {
    id: "heat",
    label: "No heat",
    hint: "Furnace, thermostat",
    category: "Heating / cooling",
    questions: [
      {
        id: "stat",
        q: "Is the thermostat set to HEAT, with the target above the room temperature?",
        options: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]],
      },
      {
        id: "sw",
        q: "There is usually a switch like a light switch on or near the furnace. Is it on?",
        options: [["on", "It is on"], ["was_off", "It was off"], ["none", "Can't find one"]],
      },
      {
        id: "temp",
        q: "What does the thermostat read inside right now?",
        options: [["lt60", "Below 60°F"], ["60_65", "60–65°F"], ["gt65", "Above 65°F"]],
      },
    ],
  },
  {
    id: "hw",
    label: "No hot water",
    hint: "Water heater",
    category: "Plumbing",
    questions: [
      { id: "pool", q: "Is there water on the floor around the water heater?", options: [["yes", "Yes"], ["no", "No, it's dry"]] },
      { id: "fuel", q: "Is the water heater gas or electric?", options: [["gas", "Gas"], ["elec", "Electric"], ["unsure", "Not sure"]] },
      {
        id: "brk",
        q: "Is the water heater breaker tripped?",
        showIf: (a) => a.fuel === "elec",
        options: [["tripped", "It was tripped"], ["ok", "Not tripped"], ["retrip", "It trips again right away"]],
      },
    ],
  },
  {
    id: "leak",
    label: "Water or a leak",
    hint: "Drips, stains, puddles",
    category: "Plumbing",
    questions: [
      {
        id: "rate",
        q: "How fast is the water moving?",
        options: [["spread", "Spreading now"], ["drip", "Steady drip"], ["slow", "Occasional drip"], ["stain", "Just a stain"]],
      },
      {
        id: "where",
        q: "Where is it coming from?",
        options: [
          ["sink", "Under a sink"], ["toilet", "Toilet base"], ["ceiling", "Through the ceiling"],
          ["pipe", "A pipe or wall"], ["appl", "An appliance"], ["unsure", "Not sure"],
        ],
      },
      {
        id: "valve",
        q: "Were you able to shut off the valve?",
        options: [["yes", "Yes, it's off"], ["no", "Couldn't find it"], ["na", "No valve there"]],
      },
    ],
  },
  {
    id: "elec",
    label: "Electrical",
    hint: "Outlets, lights, breakers",
    category: "Electrical",
    questions: [
      { id: "burn", q: "Any burning smell, scorch marks, or sparking?", options: [["no", "No"], ["yes", "Yes"]] },
      {
        id: "scope",
        q: "How much is out?",
        options: [["one", "One or two outlets"], ["room", "A whole room"], ["unit", "The whole unit"]],
      },
      {
        id: "gfci",
        q: "Have you tried the GFCI reset button?",
        showIf: (a) => a.scope === "one",
        options: [
          ["fixed", "Tried it, power is back"], ["nochange", "Tried it, no change"],
          ["not", "Haven't tried"], ["none", "Can't find one"],
        ],
      },
      {
        id: "brk",
        q: "Have you tried the breaker?",
        showIf: (a) => a.scope === "room" || a.scope === "unit",
        options: [
          ["fixed", "Reset it, power is back"], ["nochange", "Reset it, no change"],
          ["retrip", "It trips again"], ["not", "Haven't tried"],
        ],
      },
      {
        id: "nbr",
        q: "Are your neighbours out too?",
        showIf: (a) => a.scope === "unit",
        options: [["yes", "Yes, them too"], ["no", "Just my unit"], ["unsure", "Don't know"]],
      },
    ],
  },
  {
    id: "appl",
    label: "Appliance",
    hint: "Fridge, range, laundry",
    category: "Appliance",
    questions: [
      {
        id: "which",
        q: "Which appliance?",
        options: [
          ["fridge", "Refrigerator"], ["range", "Range or oven"], ["dish", "Dishwasher"],
          ["washer", "Washer"], ["dryer", "Dryer"], ["disp", "Disposal"], ["micro", "Microwave"],
        ],
      },
      {
        id: "fridge",
        q: "Is the freezer still cold?",
        showIf: (a) => a.which === "fridge",
        options: [["both", "Both are warm"], ["frz", "Freezer is still cold"]],
      },
      {
        id: "disp",
        q: "Have you pressed the red reset button underneath it?",
        showIf: (a) => a.which === "disp",
        options: [
          ["fixed", "Yes, it runs now"], ["hum", "Yes, it hums but won't turn"],
          ["dead", "Yes, still nothing"], ["not", "Haven't tried"],
        ],
      },
    ],
  },
  {
    id: "drain",
    label: "Drain or toilet",
    hint: "Slow, clogged, backing up",
    category: "Plumbing",
    questions: [
      {
        id: "sev",
        q: "How bad is it?",
        options: [["slow", "Slow but draining"], ["blocked", "Completely blocked"], ["back", "Backing up somewhere else"]],
      },
      {
        id: "fix",
        q: "Which fixture?",
        options: [
          ["toilet", "Toilet"], ["tub", "Tub or shower"], ["ksink", "Kitchen sink"],
          ["bsink", "Bathroom sink"], ["washer", "Washer drain"],
        ],
      },
      {
        id: "only",
        q: "Is this the only toilet in the unit?",
        showIf: (a) => a.fix === "toilet",
        options: [["yes", "Yes, the only one"], ["no", "There's another"]],
      },
    ],
  },
  {
    id: "lock",
    label: "Door or lock",
    hint: "Locks, keys, hardware",
    category: "Doors, windows & locks",
    questions: [
      {
        id: "secure",
        q: "Can the door close and lock right now?",
        options: [["no", "No, it won't secure"], ["sticks", "Yes, but it sticks"], ["out", "I'm locked out"]],
      },
    ],
  },
  {
    id: "pest",
    label: "Pests",
    hint: "Mice, insects, wasps",
    category: "Pests",
    questions: [
      {
        id: "what",
        q: "What are you seeing?",
        options: [
          ["mice", "Mice"], ["roach", "Roaches"], ["ant", "Ants"],
          ["wasp", "Wasps or bees"], ["bed", "Bed bugs"], ["other", "Something else"],
        ],
      },
      {
        id: "how",
        q: "How long has it been going on?",
        options: [["first", "First time"], ["days", "A few days"], ["weeks", "Weeks"]],
      },
    ],
  },
  { id: "other", label: "Something else", hint: "Describe it yourself", category: "General", questions: [] },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id);

export const visibleQuestions = (a: Answers) =>
  (categoryById(a.cat)?.questions ?? []).filter((q) => !q.showIf || q.showIf(a));

/** Shown above the form while the tenant answers, never after sending. */
export interface SelfHelp {
  heading: string;
  body: string;
  /** True when the tenant has already said it worked, so the panel offers to close it out. */
  resolved?: boolean;
}

export const selfHelp = (a: Answers): SelfHelp | null => {
  if (a.cat === "heat" && a.stat === "no")
    return {
      heading: "Try this before you send it",
      body: "Set the thermostat to HEAT and push the target about three degrees above what the room reads. Give it two minutes — most no-heat calls end right here.",
    };
  if (a.cat === "heat" && a.sw === "was_off")
    return {
      heading: "That switch is probably the whole problem",
      body: "It cuts power to the furnace and gets bumped more often than you'd think. Give it five minutes to come up to temperature before you send this.",
    };
  if (a.cat === "hw" && a.brk === "tripped")
    return {
      heading: "Reset it and give it 30 minutes",
      body: "Flip the breaker fully OFF, then back ON. A full tank takes 30 to 45 minutes to recover. If it trips again, don't keep resetting it — send this instead.",
    };
  if (a.cat === "elec" && a.scope === "one" && (a.gfci === "not" || a.gfci === "none"))
    return {
      heading: "Check the GFCI first",
      body: "Look in the bathroom, kitchen, garage, basement and outdoor outlets for one with RESET and TEST buttons — they often control outlets in a different room. Press RESET firmly. Nine times in ten that is the whole fix.",
    };
  if (a.cat === "elec" && a.gfci === "fixed")
    return {
      heading: "Sounds like you've got it",
      resolved: true,
      body: "GFCIs trip from moisture or a surge and a reset is all it takes. Close this out and we'll log it to your unit. If that circuit goes again in the next few weeks, send a request instead of resetting it.",
    };
  if (a.cat === "elec" && a.brk === "fixed")
    return {
      heading: "Sounds like you've got it",
      resolved: true,
      body: "Worth knowing what was running on that circuit — a space heater and a microwave together will do it every time. Close this out and we'll log it.",
    };
  if (a.cat === "elec" && a.scope === "unit" && a.nbr === "yes")
    return {
      heading: "This is a utility outage",
      resolved: true,
      body: "If your neighbours are out too it's We Energies, not the building, and we can't speed it up. Close this out. If it runs for hours and the place gets cold, send a request and we'll act on that.",
    };
  if (a.cat === "appl" && a.which === "disp" && a.disp === "not")
    return {
      heading: "Try the reset button first",
      body: "Reach under the disposal and press the small red button until it clicks, then run cold water and switch it on. That clears most jams.",
    };
  if (a.cat === "appl" && a.disp === "fixed")
    return {
      heading: "That's the fix",
      resolved: true,
      body: "Run cold water for 20 seconds whenever you use it and it will stay happy. Close this out — no service call, nothing billed.",
    };
  return null;
};

/** Situations where a form is the wrong channel and we want the tenant on the phone. */
export const emergencyStop = (a: Answers): SelfHelp | null => {
  if (a.cat === "elec" && a.burn === "yes")
    return {
      heading: "Stop and shut that circuit off",
      body: "Burning smells and sparking are a fire risk. If you can safely reach the panel, turn off the breaker for that area. If you see smoke or flame, get out and call 911. Then call us — don't wait on a form.",
    };
  if (a.cat === "leak" && a.rate === "spread")
    return {
      heading: "Call, don't type",
      body: "Spreading water needs a person now. For a sink or toilet the shutoff is on the wall beneath it — turn it clockwise. For anything larger the main is usually where the water line enters the basement.",
    };
  if (a.cat === "drain" && a.sev === "back")
    return {
      heading: "Stop running water and call",
      body: "Water coming up from one drain when you use another means the main line is blocked, and every extra gallon makes it worse. Stop using sinks, the shower, the toilet and the washer.",
    };
  if (a.cat === "lock" && a.secure === "no")
    return {
      heading: "Call us now",
      body: "A unit that can't be locked is an emergency and we treat it as one, whatever the hour. Someone will meet a locksmith at the door.",
    };
  if (a.cat === "lock" && a.secure === "out")
    return {
      heading: "A lockout isn't a maintenance ticket",
      body: "During office hours, call and someone can meet you with a key. Outside them, any locksmith can get you in — keep the receipt and tell us afterwards so we can check the lock if it was forced.",
    };
  return null;
};

/** The question/answer trail stored with the work order as evidence for the priority. */
export const answerTrail = (a: Answers) =>
  visibleQuestions(a).flatMap((q) => {
    const picked = q.options.find(([v]) => v === a[q.id]);
    return picked ? [{ q: q.q.replace(/\?$/, ""), a: picked[1] }] : [];
  });
