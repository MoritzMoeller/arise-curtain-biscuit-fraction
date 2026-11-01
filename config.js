// This file is public: no content here. Everything shown on the card is loaded
// from the backend (scriptUrl), and only for valid personal codes.
window.CONFIG = {
  scriptUrl: "https://script.google.com/macros/s/AKfycbzKT59q_qT0X__WjEbNV0yvZNLWicEXLZKT12iSX_rQ-3kOEWVMji7fimGc3JI7M6p1zg/exec",

  // Used only when scriptUrl is empty: open index.html?g=demo to preview the layout.
  demo: {
    guests: { demo: { greeting: "Hallo Clara, hallo David", people: ["Clara", "David"] } },
    settings: {
      title: "Gartenfest",
      options: "Nachmittag, Abend",
      submit: "Absenden",
      submitNote: "Nach dem Absenden ist die Antwort fest.",
      thanksYes: "Danke, bis bald!",
      thanksNo: "Schade – danke für die Rückmeldung.",
      noneLabel: "nicht dabei",
      lockedNote: "Änderungen bitte direkt bei uns melden.",
      dietLabel: "Sonstiges",
      dietPlaceholder: "optional",
    },
    content: [
      [1, "anrede"], [1, "text", "wir laden ein!"], [1, "name", "Anna & Ben"], [1, "text", "Samstag, 1. Januar 2000\nIrgendwo"],
      [2, "titel", "Ablauf"], [2, "zeit", "15:00", "Ankommen"], [2, "zeit", "18:00", "Essen"], [2, "link", "Karte ↗", "https://www.google.com/maps"],
      [3, "titel", "Gut zu wissen"], [3, "text", "Lorem ipsum dolor sit amet."],
      [4, "titel", "Dabei?"], [4, "text", "Bitte antwortet bis 1. Dezember 1999."], [4, "antwort"],
    ],
  },
};
