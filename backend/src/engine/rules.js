// Rules-only scoring config. No LLM, fully explainable.

// Privacy: these categories reveal health, intimate or financial-vulnerability
// information. They are NEVER used as signals, regardless of rules or toggles,
// and are skipped before any rule is evaluated.
const SENSITIVE_CATEGORIES = ["pharmacy", "health", "medical", "dating", "fertility", "pregnancy", "gambling"];

const SIGNAL_CATEGORIES = ["housing", "home_setup", "location", "vehicle", "travel"];

const EVENTS = {
  moving_home: { label: "Moving home", important: true, threshold: 120 },
  buying_car: { label: "Buying a car", important: true, threshold: 100 },
  major_trip: { label: "Major trip", important: false, threshold: 90 },
};

// A transaction uses the highest-weight matching rule per event.
const RULES = [
  { event: "moving_home", signalCategory: "housing", categories: ["real_estate"], weight: 35, reason: "Real-estate payment (agency/deposit)" },
  { event: "moving_home", signalCategory: "housing", categories: ["moving_services"], weight: 30, reason: "Moving company payment" },
  { event: "moving_home", signalCategory: "home_setup", categories: ["furniture"], weight: 15, reason: "Furniture purchase" },
  { event: "moving_home", signalCategory: "home_setup", categories: ["home_improvement"], weight: 12, reason: "DIY / home improvement purchase" },
  // special rule handled in score.js: >=3 transactions in the same new city
  { event: "moving_home", signalCategory: "location", special: "new_city", weight: 20, reason: "Repeated spending in a new city" },

  { event: "buying_car", signalCategory: "vehicle", categories: ["car_dealer"], minAmount: 5000, weight: 40, reason: "Large car dealer payment" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["car_dealer"], weight: 25, reason: "Car dealer payment" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["vehicle_registration"], weight: 30, reason: "Vehicle registration fee" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["automotive_marketplace"], weight: 15, reason: "Car marketplace activity" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["car_accessories"], weight: 10, reason: "Car accessories purchase" },

  { event: "major_trip", signalCategory: "travel", categories: ["airline"], weight: 25, reason: "Flight booking" },
  { event: "major_trip", signalCategory: "travel", categories: ["accommodation"], weight: 25, reason: "Accommodation booking" },
  { event: "major_trip", signalCategory: "travel", categories: ["travel_agency"], weight: 20, reason: "Travel agency payment" },
  { event: "major_trip", signalCategory: "travel", categories: ["travel_insurance"], weight: 15, reason: "Travel insurance" },
  { event: "major_trip", signalCategory: "travel", categories: ["travel_gear"], weight: 10, reason: "Travel gear purchase" },
  { event: "major_trip", signalCategory: "travel", categories: ["foreign_currency"], weight: 10, reason: "Foreign currency exchange" },
  { event: "major_trip", signalCategory: "travel", categories: ["international_transport"], weight: 10, reason: "International transport ticket" },
];

const MESSAGES = {
  moving_home: {
    low: "",
    medium: (c) => `Settling in ${c}? Here are some tips for your new home.`,
    high: (c) => `Moving to ${c}? Here's a checklist for your new home: update your address, home insurance and energy contracts.`,
  },
  buying_car: {
    low: "",
    medium: () => "Thinking about a car? Explore car loan and insurance options.",
    high: () => "Getting a new car? Here's a checklist: car insurance, financing and registration.",
  },
  major_trip: {
    low: "",
    medium: () => "Planning a trip? Check your card's travel benefits and limits.",
    high: () => "Big trip coming up? Review travel insurance, card limits and foreign payment settings.",
  },
};

module.exports = { SENSITIVE_CATEGORIES, SIGNAL_CATEGORIES, EVENTS, RULES, MESSAGES };
