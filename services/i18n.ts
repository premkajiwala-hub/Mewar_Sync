/**
 * Navigation and shell labels in the languages the profile settings offer.
 * Page content remains English; these labels help artisans who read Hindi
 * or Marwari find their way around.
 */
export type AppLanguage = 'English' | 'Hindi' | 'Marwadi';

export const LANGUAGE_OPTIONS: { value: AppLanguage; label: string; htmlLang: string }[] = [
  { value: 'English', label: 'English', htmlLang: 'en' },
  { value: 'Hindi', label: 'हिन्दी (Hindi)', htmlLang: 'hi' },
  { value: 'Marwadi', label: 'मारवाड़ी (Marwari)', htmlLang: 'hi' },
];

type Key =
  | 'overview' | 'ledger' | 'inventory' | 'udhaar' | 'reports' | 'gallery' | 'scan' | 'settings'
  | 'explore' | 'artisans' | 'translator' | 'authenticity' | 'placePhotos' | 'messages' | 'signOut'
  | 'workshop' | 'showcase' | 'account' | 'discover' | 'tools' | 'admin';

const LABELS: Record<AppLanguage, Record<Key, string>> = {
  English: {
    overview: 'Overview', ledger: 'Ledger', inventory: 'Inventory', udhaar: 'Udhaar', reports: 'Reports',
    gallery: 'My gallery', scan: 'Scan to list', settings: 'Settings', explore: 'Explore Udaipur',
    artisans: 'Artisans', translator: 'Translator', authenticity: 'Authenticity check', placePhotos: 'Place photos',
    messages: 'Messages', signOut: 'Sign out', workshop: 'Workshop', showcase: 'Showcase', account: 'Account',
    discover: 'Discover', tools: 'Tools', admin: 'Administration',
  },
  Hindi: {
    overview: 'सारांश', ledger: 'बही-खाता', inventory: 'स्टॉक', udhaar: 'उधार', reports: 'रिपोर्ट',
    gallery: 'मेरी गैलरी', scan: 'स्कैन कर जोड़ें', settings: 'सेटिंग्स', explore: 'उदयपुर देखें',
    artisans: 'कारीगर', translator: 'अनुवादक', authenticity: 'प्रामाणिकता जांच', placePhotos: 'स्थल फ़ोटो',
    messages: 'संदेश', signOut: 'लॉग आउट', workshop: 'कारखाना', showcase: 'प्रदर्शनी', account: 'खाता',
    discover: 'खोजें', tools: 'उपकरण', admin: 'प्रशासन',
  },
  Marwadi: {
    overview: 'सार', ledger: 'बही-खातो', inventory: 'माल-सामान', udhaar: 'उधारो', reports: 'रिपोर्ट',
    gallery: 'म्हारी गैलरी', scan: 'स्कैन कर जोड़ो', settings: 'सेटिंग्स', explore: 'उदयपुर देखो',
    artisans: 'कारीगर', translator: 'दुभाषियो', authenticity: 'सांचो-झूठो जांचो', placePhotos: 'जगां री फ़ोटो',
    messages: 'संदेसा', signOut: 'बारै निकळो', workshop: 'कारखानो', showcase: 'दिखावो', account: 'खातो',
    discover: 'खोजो', tools: 'औजार', admin: 'प्रशासन',
  },
};

export function t(key: Key, lang?: string): string {
  const set = LABELS[(lang as AppLanguage) in LABELS ? (lang as AppLanguage) : 'English'];
  return set[key] ?? LABELS.English[key];
}

export function htmlLangFor(lang?: string): string {
  return LANGUAGE_OPTIONS.find(l => l.value === lang)?.htmlLang ?? 'en';
}
