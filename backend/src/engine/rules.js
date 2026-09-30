// Rules-only scoring config. No LLM, fully explainable.

// Privacy: these categories reveal health, intimate or financial-vulnerability
// information. They are NEVER used as signals, regardless of rules or toggles,
// and are skipped before any rule is evaluated.
const SENSITIVE_CATEGORIES = ["pharmacy", "health", "medical", "dating", "fertility", "pregnancy", "gambling"];

const SIGNAL_CATEGORIES = ["housing", "home_setup", "location", "vehicle", "travel"];

const EVENTS = {
  moving_home: { label: "Moving home", important: true, threshold: 30 },
  buying_car: { label: "Buying a car", important: true, threshold: 26 },
  major_trip: { label: "Major trip", important: false, threshold: 24 },
};

// Each matching signal adds small integer points (weight); confidence = points / threshold.
// A transaction uses the highest-weight matching rule per event.
const RULES = [
  { event: "moving_home", signalCategory: "housing", categories: ["real_estate"], weight: 7, reason: "Real-estate payment (agency/deposit)" },
  { event: "moving_home", signalCategory: "housing", categories: ["moving_services"], weight: 6, reason: "Moving company payment" },
  { event: "moving_home", signalCategory: "home_setup", categories: ["furniture"], weight: 3, reason: "Furniture purchase" },
  { event: "moving_home", signalCategory: "home_setup", categories: ["home_improvement"], weight: 2, reason: "DIY / home improvement purchase" },
  // special rule handled in score.js: >=3 transactions in the same new city
  { event: "moving_home", signalCategory: "location", special: "new_city", weight: 4, reason: "Repeated spending in a new city" },

  { event: "buying_car", signalCategory: "vehicle", categories: ["car_dealer"], minAmount: 5000, weight: 8, reason: "Large car dealer payment" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["car_dealer"], weight: 5, reason: "Car dealer payment" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["vehicle_registration"], weight: 6, reason: "Vehicle registration fee" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["automotive_marketplace"], weight: 3, reason: "Car marketplace activity" },
  { event: "buying_car", signalCategory: "vehicle", categories: ["car_accessories"], weight: 2, reason: "Car accessories purchase" },

  { event: "major_trip", signalCategory: "travel", categories: ["airline"], weight: 5, reason: "Flight booking" },
  { event: "major_trip", signalCategory: "travel", categories: ["accommodation"], weight: 5, reason: "Accommodation booking" },
  { event: "major_trip", signalCategory: "travel", categories: ["travel_agency"], weight: 4, reason: "Travel agency payment" },
  { event: "major_trip", signalCategory: "travel", categories: ["travel_insurance"], weight: 3, reason: "Travel insurance" },
  { event: "major_trip", signalCategory: "travel", categories: ["travel_gear"], weight: 2, reason: "Travel gear purchase" },
  { event: "major_trip", signalCategory: "travel", categories: ["foreign_currency"], weight: 2, reason: "Foreign currency exchange" },
  { event: "major_trip", signalCategory: "travel", categories: ["international_transport"], weight: 2, reason: "International transport ticket" },
];

const MESSAGES = {
  moving_home: {
    low: "",
    medium: (c) => `Settling into a new place? Here are a few tips for ${c}.`,
    high: (c) => `We noticed you may be preparing for a move to ${c}. Here's a checklist: address change, home insurance, energy contracts.`,
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

const ACTION_LABELS = { none: "No action", personalise: "Quiet personalisation", guidance: "Show guidance", advisor: "Human review" };

module.exports = { ACTION_LABELS, SENSITIVE_CATEGORIES, SIGNAL_CATEGORIES, EVENTS, RULES, MESSAGES };
