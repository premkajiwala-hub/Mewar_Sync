import { MapLocation } from '../types';

export const LOCATIONS: MapLocation[] = [
  // Heritage Sites
  { 
    id: 'h1', 
    name: 'City Palace', 
    type: 'HERITAGE', 
    lat: 24.5764, 
    lng: 73.6835, 
    image_url: 'https://images.unsplash.com/photo-1602143352538-23267598858d?auto=format&fit=crop&w=1200', 
    description: 'The majestic residence of the Mewar rulers, a fusion of Rajasthani and Mughal architecture. Built over 400 years, this sprawling complex features intricate peacock mosaics, mirrored galleries, and panoramic views of Lake Pichola. It stands as a testament to the resilience and artistic grandeur of the Mewar dynasty.',
    entry_fee_indian: 400,
    entry_fee_indian_child: 150,
    entry_fee_foreigner: 800,
    entry_fee_foreigner_child: 300,
    activity_costs: [
      { name: 'Boat Ride to Jag Mandir', cost: 400, note: '₹400 - ₹700' },
      { name: 'Audio Guide (Indian)', cost: 225 },
      { name: 'Audio Guide (Foreign)', cost: 450 },
      { name: 'Crystal Gallery', cost: 700 },
      { name: 'Vintage Car Collection', cost: 400 },
      { name: 'Mewar Sound & Light Show', cost: 250, note: 'Starts at 7:00 PM' }
    ],
    camera_fee: 250,
    video_fee: 500,
    timings: { open: '09:00', close: '21:00' }
  },
  { 
    id: 'h2', 
    name: 'Lake Pichola', 
    type: 'HERITAGE', 
    lat: 24.5700, 
    lng: 73.6780, 
    image_url: 'https://images.unsplash.com/photo-1590050752117-23a9d7fc6f97?auto=format&fit=crop&w=1200', 
    description: 'An artificial fresh water lake, created in the year 1362 AD, named after the nearby Picholi village. It is one of the oldest and largest lakes of Udaipur, famous for its scenic beauty and the iconic Lake Palace (Jag Niwas) that appears to float on its tranquil waters.',
    entry_fee_indian: 0,
    entry_fee_foreigner: 0,
    activity_costs: [
      { name: 'Sunset Boat Cruise', cost: 700 },
      { name: 'Jag Mandir Island Visit', cost: 400, note: 'Included in boat ride' },
      { name: 'Photography at Gangaur Ghat', cost: 0 },
      { name: 'Evening Walk at Ambrai Ghat', cost: 0 }
    ],
    timings: { open: '09:00', close: '18:00' }
  },
  { 
    id: 'h3', 
    name: 'Jagdish Temple', 
    type: 'HERITAGE', 
    lat: 24.5792, 
    lng: 73.6845, 
    image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200', 
    description: 'A large Hindu temple in the middle of Udaipur, just outside the royal palace. Built in 1651, it is a stunning example of Indo-Aryan architecture, featuring three stories of hand-carved stone, beautifully sculpted pillars, and a massive bronze statue of Garuda.',
    entry_fee_indian: 0,
    entry_fee_foreigner: 0,
    activity_costs: [
      { name: 'Morning Aarti', cost: 0, note: 'Starts at 5:00 AM' },
      { name: 'Evening Aarti', cost: 0, note: 'Starts at 6:30 PM' },
      { name: 'Heritage Walk (Old City)', cost: 500, note: 'Guided tour' }
    ],
    timings: { open: '05:00', close: '22:00', note: 'Closed 2:30 PM - 4:00 PM' }
  },
  { 
    id: 'h4', 
    name: 'Saheliyon-ki-Bari', 
    type: 'HERITAGE', 
    lat: 24.6042, 
    lng: 73.6842, 
    image_url: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200', 
    description: 'A popular tourist space and a major garden in Udaipur, built by Maharana Sangram Singh in the 18th century for the royal ladies. Known as the "Garden of the Maidens", it features lush green lawns, marble elephants, and unique lotus pools with rain-fountains.',
    entry_fee_indian: 30,
    entry_fee_indian_child: 30,
    entry_fee_foreigner: 150,
    entry_fee_foreigner_child: 150,
    activity_costs: [
      { name: 'Museum Entry', cost: 10 },
      { name: 'Pre-wedding Shoot', cost: 5000, note: 'For 4 hours' },
      { name: 'Traditional Dress Photography', cost: 200 },
      { name: 'Fountain Show', cost: 0, note: 'Every 15 mins' }
    ],
    timings: { open: '09:00', close: '18:00' }
  },
  { 
    id: 'h5', 
    name: 'Bagore Ki Haveli', 
    type: 'HERITAGE', 
    lat: 24.5795, 
    lng: 73.6800, 
    image_url: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200', 
    description: 'A historic haveli that stands on the platform of Gangori Ghat, right on the waterfront of Lake Pichola. Built in the 18th century, it houses over 100 rooms displaying traditional costumes, modern art, and the world\'s largest turban.',
    entry_fee_indian: 60,
    entry_fee_indian_child: 30,
    entry_fee_foreigner: 100,
    entry_fee_foreigner_child: 50,
    camera_fee: 50,
    activity_costs: [
      { name: 'Dharohar Folk Dance (Indian)', cost: 90, note: 'Adult: ₹90, Child: ₹45' },
      { name: 'Dharohar Folk Dance (Foreign)', cost: 150, note: 'Adult: ₹150, Child: ₹75' },
      { name: 'Dharohar Camera Fee', cost: 150 },
      { name: 'Puppet Show', cost: 0, note: 'Part of Dharohar' },
      { name: 'Museum Tour', cost: 60 }
    ],
    must_do: 'Dharohar Folk Dance: 7:00 PM – 8:00 PM',
    timings: { open: '09:00', close: '18:00' }
  },
  { 
    id: 'h6', 
    name: 'Sajjangarh (Monsoon Palace)', 
    type: 'HERITAGE', 
    lat: 24.5900, 
    lng: 73.6300, 
    image_url: 'https://images.unsplash.com/photo-1602143352538-23267598858d?auto=format&fit=crop&w=1200', 
    description: 'A hilltop palatial residence in Udaipur, overlooking the Fateh Sagar Lake. Built in 1884, it was designed to watch the monsoon clouds and offers breathtaking 360-degree views of the Aravalli hills and the entire city below.',
    entry_fee_indian: 120,
    entry_fee_indian_child: 120,
    entry_fee_foreigner: 500,
    entry_fee_foreigner_child: 500,
    activity_costs: [
      { name: 'Shared Jeep (Mandatory)', cost: 90 },
      { name: 'Wildlife Sanctuary Safari', cost: 300 },
      { name: 'Parking (2-wheeler)', cost: 55 },
      { name: 'Parking (4-wheeler)', cost: 338 },
      { name: 'Trekking to the Top', cost: 0 }
    ],
    must_do: 'Sunset Viewpoint: Best at 5:30 PM.',
    timings: { open: '09:00', close: '18:00' }
  },
  { 
    id: 'h7', 
    name: 'Fateh Sagar Lake', 
    type: 'HERITAGE', 
    lat: 24.6000, 
    lng: 73.6700, 
    image_url: 'https://images.unsplash.com/photo-1590050752117-23a9d7fc6f97?auto=format&fit=crop&w=1200', 
    description: 'An artificial lake named after Maharana Fateh Singh of Udaipur and Mewar, built in the 1680s. It is the second largest of the four lakes in Udaipur and is home to three small islands, including Nehru Park and the Udaipur Solar Observatory.',
    entry_fee_indian: 0,
    entry_fee_foreigner: 0,
    activity_costs: [
      { name: 'Speed Boat', cost: 236 },
      { name: 'Motor Boat', cost: 177 },
      { name: 'Visit Nehru Park', cost: 30, note: 'Boat ride to island' },
      { name: 'Camel/Horse Ride on Pal', cost: 50, note: 'Starts from ₹50' },
      { name: 'Street Food at Bombay Market', cost: 100, note: 'Approx cost' }
    ],
    timings: { open: '09:00', close: '18:00' }
  },
  { 
    id: 'h8', 
    name: 'Gulab Bagh', 
    type: 'HERITAGE', 
    lat: 24.5700, 
    lng: 73.6900, 
    image_url: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200', 
    description: 'The largest garden in Udaipur, spread over 100 acres, containing a zoo, library, and a toy train. Established in 1881, it is named for its abundance of roses and serves as a green lung for the city, housing ancient trees and medicinal plants.',
    entry_fee_indian: 25,
    entry_fee_indian_child: 25,
    entry_fee_foreigner: 25,
    entry_fee_foreigner_child: 25,
    activity_costs: [
      { name: 'Zoo Entry', cost: 5 },
      { name: 'Camera (Zoo)', cost: 15 },
      { name: 'Toy Train Ride', cost: 50 },
      { name: 'Visit Bird Park', cost: 30 },
      { name: 'Saraswati Library Visit', cost: 0 }
    ],
    timings: { open: '09:00', close: '18:00' }
  },
  { 
    id: 'h9', 
    name: 'Ahar Cenotaphs', 
    type: 'HERITAGE', 
    lat: 24.5880, 
    lng: 73.7150, 
    image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200', 
    description: 'A group of royal cenotaphs of the Maharanas of Mewar, located about 2 km east of Udaipur. This archaeological site contains over 250 cenotaphs built over 350 years, featuring striking marble domes and intricate carvings.',
    entry_fee_indian: 0,
    entry_fee_indian_child: 0,
    entry_fee_foreigner: 0,
    entry_fee_foreigner_child: 0,
    activity_costs: [
      { name: 'Ahar Museum', cost: 20 },
      { name: 'Guided History Tour', cost: 200 }
    ],
    timings: { open: '10:00', close: '17:00' }
  },
  { 
    id: 'h10', 
    name: 'Ambrai Ghat', 
    type: 'HERITAGE', 
    lat: 24.5780, 
    lng: 73.6780, 
    image_url: 'https://images.unsplash.com/photo-1590050752117-23a9d7fc6f97?auto=format&fit=crop&w=1200', 
    description: 'A popular waterfront spot offering panoramic views of the City Palace and Lake Palace. Located on the banks of Lake Pichola, it is a serene location where visitors can witness the golden glow of the palace lights reflecting on the water.',
    entry_fee_indian: 0,
    entry_fee_foreigner: 0,
    activity_costs: [
      { name: 'Evening Photography', cost: 0 },
      { name: 'Sunset View', cost: 0 },
      { name: 'Lakeside Dinner', cost: 1000, note: 'Approx cost at nearby restaurants' }
    ],
    timings: { open: '05:00', close: '22:00' }
  },
  
  // Market Hubs
  { 
    id: 'm1', 
    name: 'Hathi Pol Bazaar', 
    type: 'MARKET', 
    lat: 24.5850, 
    lng: 73.6850, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'Famous for traditional Rajasthani handicrafts, especially miniature paintings and Pichwai art. A must-visit for authentic souvenirs.', 
    mewari_bol: [{ phrase: 'Khamma Ghani', meaning: 'Greetings' }, { phrase: 'O hath-su banyodo hai?', meaning: 'Is this handmade?' }, { phrase: 'Sahi daam lagao', meaning: 'Best Price?' }],
    shopping_guide: {
      best_buys: ['Miniature Paintings', 'Pichwai Art', 'Camel Bone Artifacts'],
      bargaining_tips: ['Start at 40-50% of the initial quote', 'Bundle items for better discounts', 'Visit early morning for "Bohni" (first sale) luck'],
      local_specialty: 'Traditional Miniature Paintings'
    },
    activity_costs: [
      { name: 'Miniature Painting Workshop', cost: 500 },
      { name: 'Art Gallery Tour', cost: 0 }
    ],
    timings: { open: '10:00', close: '20:00' }
  },
  { 
    id: 'm7', 
    name: 'Shilpgram', 
    type: 'MARKET', 
    lat: 24.6050, 
    lng: 73.6550, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'Rural arts and crafts complex, perfect for authentic tribal art and witnessing live demonstrations of traditional skills.',
    shopping_guide: {
      best_buys: ['Terracotta Pottery', 'Tribal Jewelry', 'Hand-woven Textiles'],
      bargaining_tips: ['Prices are often fixed at government stalls', 'Directly support artisans by buying from their huts', 'Check for live craft demonstrations'],
      local_specialty: 'Terracotta Work & Tribal Art'
    },
    activity_costs: [
      { name: 'Camel/Horse Rides', cost: 50, note: 'Starts from ₹50' },
      { name: 'Pottery Workshop', cost: 100 },
      { name: 'Tribal Dance Performance', cost: 0, note: 'Free with entry' }
    ],
    timings: { open: '11:00', close: '19:00' }
  },
  { 
    id: 'm2', 
    name: 'Bada Bazaar', 
    type: 'MARKET', 
    lat: 24.5820, 
    lng: 73.6880, 
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200', 
    description: 'The main market area for textiles, jewelry, and leather goods. It captures the vibrant spirit of Udaipur\'s daily commerce.', 
    mewari_bol: [{ phrase: 'Ram Ram sa', meaning: 'Greetings' }, { phrase: 'Asli chamdo hai?', meaning: 'Is this real leather?' }, { phrase: 'Thodo sasto karo', meaning: 'Make it a bit cheaper' }], 
    shopping_guide: {
      best_buys: ['Bandhani Textiles', 'Silver Jewelry', 'Leather Bags'],
      bargaining_tips: ['Compare prices across multiple shops', 'Look for shops in the inner lanes for better deals', 'Check the weight of silver jewelry'],
      local_specialty: 'Bandhani & Leheriya Textiles'
    },
    activity_costs: [
      { name: 'Textile Printing Demo', cost: 0 },
      { name: 'Jewelry Customization', cost: 0, note: 'Variable cost' }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm3', 
    name: 'Mochiwada', 
    type: 'MARKET', 
    lat: 24.5810, 
    lng: 73.6890, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'The hub for traditional Mojari (leather footwear). Watch artisans at work creating these colorful, hand-stitched shoes.', 
    mewari_bol: [{ phrase: 'Ghani khamma', meaning: 'Many greetings' }, { phrase: 'Jutti badhiya hai', meaning: 'The shoes are good' }, { phrase: 'Pura hath ro kaam hai?', meaning: 'Is it fully handmade?' }], 
    shopping_guide: {
      best_buys: ['Leather Mojaris', 'Embroidered Juttis', 'Leather Belts'],
      bargaining_tips: ['Try them on for comfort first', 'Smell the leather to ensure it is genuine', 'Ask for a discount if buying multiple pairs'],
      local_specialty: 'Handcrafted Leather Mojaris'
    },
    activity_costs: [
      { name: 'Leather Crafting Demo', cost: 0 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm4', 
    name: 'Maldas Street', 
    type: 'MARKET', 
    lat: 24.5830, 
    lng: 73.6870, 
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200', 
    description: 'Famous for wedding attire, ethnic wear, and Bandhani textiles. A colorful street filled with traditional Rajasthani fashion.', 
    mewari_bol: [{ phrase: 'Banna sa', meaning: 'Respectful address' }, { phrase: 'Rang kacho to koni?', meaning: 'Will the color fade?' }, { phrase: 'Wajib daam batao', meaning: 'Tell a fair price' }], 
    shopping_guide: {
      best_buys: ['Wedding Lehengas', 'Ethnic Suits', 'Bandhani Sarees'],
      bargaining_tips: ['Best for bulk wedding shopping', 'Ask for "wholesale" rates if buying many', 'Check the quality of embroidery/zari'],
      local_specialty: 'Ethnic Wedding Wear'
    },
    activity_costs: [
      { name: 'Bridal Wear Consultation', cost: 0 },
      { name: 'Custom Tailoring', cost: 0, note: 'Variable cost' }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm5', 
    name: 'Clock Tower Market', 
    type: 'MARKET', 
    lat: 24.5800, 
    lng: 73.6860, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'Specializes in copper and brass items, as well as silver jewelry. The rhythmic sound of metalwork fills the air here.', 
    mewari_bol: [{ phrase: 'Sa', meaning: 'Respectful suffix' }, { phrase: 'Asli tambo hai?', meaning: 'Is this real copper?' }, { phrase: 'Ghani mehngi hai', meaning: 'It is very expensive' }], 
    shopping_guide: {
      best_buys: ['Copper Utensils', 'Brass Artifacts', 'Silver Jewelry'],
      bargaining_tips: ['Prices often depend on the weight of the metal', 'Look for intricate hand-beaten patterns', 'Ask about the purity of silver'],
      local_specialty: 'Copper & Brass Metalwork'
    },
    activity_costs: [
      { name: 'Silver Smithing Demo', cost: 0 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm6', 
    name: 'Rajasthali', 
    type: 'MARKET', 
    lat: 24.5840, 
    lng: 73.6830, 
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200', 
    description: 'Government emporium for authentic Rajasthani crafts, ensuring fair prices and certified quality for artisans.', 
    shopping_guide: {
      best_buys: ['Blue Pottery', 'Marble Handicrafts', 'Authentic Textiles'],
      bargaining_tips: ['Prices are fixed (Government run)', 'Quality is guaranteed and certified', 'Ideal for those who prefer no-hassle shopping'],
      local_specialty: 'Certified Rajasthani Handicrafts'
    },
    activity_costs: [
      { name: 'Craft History Tour', cost: 0 }
    ],
    timings: { open: '10:00', close: '19:00' } 
  },
  { 
    id: 'm8', 
    name: 'Chetek Circle', 
    type: 'MARKET', 
    lat: 24.5920, 
    lng: 73.6850, 
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200', 
    description: 'Popular for traditional puppets, wooden toys, and hand-painted pottery. A great spot for finding unique gifts.', 
    shopping_guide: {
      best_buys: ['Rajasthani Puppets', 'Wooden Toys', 'Hand-painted Pottery'],
      bargaining_tips: ['Great for small souvenirs', 'Check the mechanism of puppets', 'Bargain more if buying a set of toys'],
      local_specialty: 'Traditional Puppets & Toys'
    },
    activity_costs: [
      { name: 'Puppet Making Workshop', cost: 300 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm9', 
    name: 'Lake Palace Road', 
    type: 'MARKET', 
    lat: 24.5750, 
    lng: 73.6880, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'Lined with high-end shops selling quality textiles, silver jewelry, and precious gemstones near the palace gates.', 
    shopping_guide: {
      best_buys: ['Precious Gemstones', 'High-end Textiles', 'Designer Jewelry'],
      bargaining_tips: ['Expect higher starting prices due to location', 'Quality is generally superior', 'Ask for certificates for gemstones'],
      local_specialty: 'Gemstones & Fine Jewelry'
    },
    activity_costs: [
      { name: 'Gemstone Identification', cost: 0 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm10', 
    name: 'Lakhara Chowk', 
    type: 'MARKET', 
    lat: 24.5815, 
    lng: 73.6865, 
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200', 
    description: 'The historic center for traditional Lac bangles. See artisans melt and shape colorful resin into beautiful jewelry.', 
    shopping_guide: {
      best_buys: ['Lac Bangles', 'Resin Jewelry', 'Customized Bangles'],
      bargaining_tips: ['Watch them being made to ensure authenticity', 'Ask for custom sizes or colors', 'Buy in sets for better pricing'],
      local_specialty: 'Handcrafted Lac Bangles'
    },
    activity_costs: [
      { name: 'Live Lac Bangle Making', cost: 0 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm11', 
    name: 'Sindhi Bazaar', 
    type: 'MARKET', 
    lat: 24.5805, 
    lng: 73.6875, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'Known for exotic spices, traditional Rajasthani snacks, and local sweets. A feast for the senses.', 
    shopping_guide: {
      best_buys: ['Local Spices', 'Rajasthani Namkeen', 'Traditional Sweets'],
      bargaining_tips: ['Ask for a taste before buying', 'Buy fresh spices for better aroma', 'Check the expiry/freshness of snacks'],
      local_specialty: 'Authentic Spices & Savories'
    },
    activity_costs: [
      { name: 'Spice Tasting', cost: 0 },
      { name: 'Traditional Sweet Making Demo', cost: 0 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm12', 
    name: 'Ghantaghar', 
    type: 'MARKET', 
    lat: 24.5800, 
    lng: 73.6860, 
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200', 
    description: 'A historic area with numerous silver and gemstone shops, famous for its ancient clock tower and bustling energy.', 
    shopping_guide: {
      best_buys: ['Silver Ornaments', 'Gemstone Jewelry', 'Antique Items'],
      bargaining_tips: ['Very competitive pricing', 'Explore the narrow alleys for hidden gems', 'Verify the silver hallmark if possible'],
      local_specialty: 'Silver & Gemstone Art'
    },
    activity_costs: [
      { name: 'Antique Appraisal', cost: 0 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
  { 
    id: 'm13', 
    name: 'Panchwati', 
    type: 'MARKET', 
    lat: 24.5950, 
    lng: 73.6850, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'A modern shopping area that blends traditional boutiques with contemporary Rajasthani design and lifestyle.', 
    shopping_guide: {
      best_buys: ['Designer Ethnic Wear', 'Modern Handicrafts', 'Home Decor'],
      bargaining_tips: ['More boutique-style shops', 'Fixed or semi-fixed prices', 'Look for unique fusion designs'],
      local_specialty: 'Modern Rajasthani Lifestyle'
    },
    activity_costs: [
      { name: 'Fashion Styling Session', cost: 0 }
    ],
    timings: { open: '10:00', close: '21:00' } 
  },
  { 
    id: 'm14', 
    name: 'Bapu Bazaar', 
    type: 'MARKET', 
    lat: 24.5850, 
    lng: 73.6950, 
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200', 
    description: 'A bustling market for everyday items, street food, and traditional Rajasthani footwear. The heart of local shopping.', 
    shopping_guide: {
      best_buys: ['Street Food', 'Daily Wear Textiles', 'Local Footwear'],
      bargaining_tips: ['The most local market experience', 'Bargain hard for non-food items', 'Try the local street food while you shop'],
      local_specialty: 'Local Shopping & Street Food'
    },
    activity_costs: [
      { name: 'Street Food Tour', cost: 300 }
    ],
    timings: { open: '10:00', close: '21:00' } 
  },
  { 
    id: 'm15', 
    name: 'Gangaur Ghat Market', 
    type: 'MARKET', 
    lat: 24.5795, 
    lng: 73.6805, 
    image_url: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200', 
    description: 'Scenic market area near the lake, great for local art, paintings, and capturing the essence of Udaipur\'s waterfront.', 
    shopping_guide: {
      best_buys: ['Local Art', 'Sketchbooks', 'Hand-painted Postcards'],
      bargaining_tips: ['Ideal for artistic souvenirs', 'Prices can be higher due to the view', 'Look for local artists working on the ghats'],
      local_specialty: 'Lakefront Art & Souvenirs'
    },
    activity_costs: [
      { name: 'Live Sketching Session', cost: 0 },
      { name: 'Photography Workshop', cost: 500 }
    ],
    timings: { open: '10:00', close: '20:00' } 
  },
];
