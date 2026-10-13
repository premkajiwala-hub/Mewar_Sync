
export type LanguageCode = string;

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', region: 'Global' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', region: 'India' },
  { code: 'mwr', name: 'Marwari', native: 'मारवाड़ी', region: 'Rajasthan' },
  { code: 'mew', name: 'Mewari', native: 'मेवाड़ी', region: 'Udaipur' }
];

export const translations: Record<string, any> = {
  en: {
    welcome: "Welcome to Mewar",
    dashboard: "Dashboard",
    gallery: "My Gallery",
    ledger: "Registry",
    sell: "Scan to List",
    settings: "Profile",
    logout: "Leave Mewar",
    bazaar: "The Bazaar",
    translator: "Translator",
    verify: "Check Authenticity",
    guide: "Discovery Guide",
    choose_dialect: "Choose Your Dialect",
    continue: "CONTINUE TO GATEWAY"
  },
  hi: {
    welcome: "मेवाड़ में आपका स्वागत है",
    dashboard: "बही-खाता",
    gallery: "मेरी गैलरी",
    ledger: "रजिस्टर",
    sell: "स्कैन कर जोड़ें",
    settings: "प्रोफाइल",
    logout: "लॉगआउट",
    bazaar: "बाज़ार",
    translator: "अनुवादक",
    verify: "प्रामाणिकता जांच",
    guide: "विरासत गाइड",
    choose_dialect: "अपनी भाषा चुनें",
    continue: "आगे बढ़ें"
  },
  mwr: {
    welcome: "मेवाड़ में थारो स्वागत है",
    dashboard: "बही-खातो",
    gallery: "म्हारी गैलरी",
    ledger: "रजिस्टर",
    sell: "नयी चीज़ जोड़ो",
    settings: "म्हारी ओळखाण",
    logout: "विराम लेओ",
    bazaar: "हाट-बाज़ार",
    translator: "दुभाषियो",
    verify: "सांचो-झूठो जांचो",
    guide: "घूमबा को रास्तो",
    choose_dialect: "बोली चुणो",
    continue: "आगे चालो"
  },
  mew: {
    welcome: "मेवाड़ में आपणो स्वागत है",
    dashboard: "बही-खातो",
    gallery: "मारी गैलरी",
    ledger: "रजिस्टर",
    sell: "नई चीज़ जोड़ो",
    settings: "मारी प्रोफाइल",
    logout: "बारै निकलो",
    bazaar: "बाज़ार",
    translator: "अनुवादक",
    verify: "अस्ल-नक्ल देखो",
    guide: "विरासत गाइड",
    choose_dialect: "अपनी बोली चुणो",
    continue: "अगाड़ी चालो"
  }
};

export const t = (key: string, lang: string) => {
  const code = LANGUAGES.find(l => l.name === lang)?.code || 'en';
  const langSet = translations[code] || translations['en'];
  return langSet[key] || translations['en'][key] || key;
};
