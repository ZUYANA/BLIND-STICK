import { Coordinates, PlacePOI } from '../types';

export const CHIKKAMAGALURU_COORDS: Coordinates = {
  lat: 13.3161,
  lng: 75.7720
};

// Bounding box for the WHOLE city of Chikkamagaluru
export const CKM_CITY_BOUNDS = {
  southWest: { lat: 13.2920, lng: 75.7400 },
  northEast: { lat: 13.3480, lng: 75.8080 },
  center: { lat: 13.3200, lng: 75.7740 },
  defaultZoom: 13.2
};

// Comprehensive real-world landmarks spanning the entire Chikkamagaluru city (North, South, East, West, Central)
export const CKM_KNOWN_PLACES: PlacePOI[] = [
  // --- Central Chikkamagaluru ---
  {
    id: 'ckm-hosp-1',
    name: 'District General Hospital Chikkamagaluru',
    category: 'Hospital',
    address: 'Hospital Road, Joythinagar, Chikkamagaluru, Karnataka 577101',
    lat: 13.3218,
    lng: 75.7765
  },
  {
    id: 'ckm-hosp-2',
    name: 'Ashraya Hospital & Trauma Center',
    category: 'Hospital',
    address: 'K.M. Road, Chikkamagaluru, Karnataka 577101',
    lat: 13.3185,
    lng: 75.7712
  },
  {
    id: 'ckm-hosp-3',
    name: 'Bolaram Hospital & Diagnostic Centre',
    category: 'Hospital',
    address: 'Indira Gandhi Road, Chikkamagaluru, Karnataka 577101',
    lat: 13.3142,
    lng: 75.7728
  },
  {
    id: 'ckm-bus-1',
    name: 'KSRTC Central Bus Stand Chikkamagaluru',
    category: 'Bus Stand',
    address: 'Indira Gandhi Road, Chikkamagaluru, Karnataka 577101',
    lat: 13.3135,
    lng: 75.7745
  },
  {
    id: 'ckm-bus-2',
    name: 'Private Bus Stand CKM',
    category: 'Bus Stand',
    address: 'Market Road, Near Clock Tower, Chikkamagaluru',
    lat: 13.3162,
    lng: 75.7752
  },
  {
    id: 'ckm-park-1',
    name: 'Azad Park & Civic Promenade',
    category: 'Park',
    address: 'Azad Road, Joythinagar, Chikkamagaluru, Karnataka 577101',
    lat: 13.3152,
    lng: 75.7758
  },
  {
    id: 'ckm-shop-1',
    name: 'MG Road Coffee & Spice Market',
    category: 'Market',
    address: 'Mahatma Gandhi Road, Chikkamagaluru, Karnataka 577101',
    lat: 13.3168,
    lng: 75.7742
  },
  {
    id: 'ckm-rest-1',
    name: 'Town Canteen (Heritage Cafe)',
    category: 'Restaurant',
    address: 'SH 57, Ratnagiri Road, Chikkamagaluru, Karnataka 577101',
    lat: 13.3190,
    lng: 75.7680
  },
  {
    id: 'ckm-rest-2',
    name: 'Hotel Vishnu Delicacy',
    category: 'Restaurant',
    address: 'MG Road, Joythinagar, Chikkamagaluru, Karnataka 577101',
    lat: 13.3174,
    lng: 75.7738
  },
  {
    id: 'ckm-pharm-1',
    name: 'Apollo Pharmacy CKM',
    category: 'Pharmacy',
    address: 'IG Road, Opposite District Stadium, Chikkamagaluru',
    lat: 13.3148,
    lng: 75.7732
  },

  // --- North & North-East Chikkamagaluru ---
  {
    id: 'ckm-train-1',
    name: 'Chikkamagaluru Railway Station',
    category: 'Railway Station',
    address: 'Station Road, Jyothinagar Extension, Chikkamagaluru 577102',
    lat: 13.3320,
    lng: 75.7980
  },
  {
    id: 'ckm-park-2',
    name: 'Rathnagiri Bore & Viewpoint Park',
    category: 'Park & Viewpoint',
    address: 'Rathnagiri Road, North Chikkamagaluru 577101',
    lat: 13.3340,
    lng: 75.7620
  },
  {
    id: 'ckm-edu-1',
    name: 'Adichunchanagiri Institute of Technology (AIT CKM)',
    category: 'College & University',
    address: 'KM Road, Chikkamagaluru 577102',
    lat: 13.3410,
    lng: 75.7890
  },
  {
    id: 'ckm-stadium-1',
    name: 'District Sports Stadium CKM',
    category: 'Sports & Public Grounds',
    address: 'Near IG Road, Joythinagar, Chikkamagaluru',
    lat: 13.3195,
    lng: 75.7780
  },

  // --- East Chikkamagaluru ---
  {
    id: 'ckm-temple-1',
    name: 'Hiremagalur Sri Kodandarama Temple',
    category: 'Heritage & Temple',
    address: 'Hiremagalur, East Chikkamagaluru 577102',
    lat: 13.3285,
    lng: 75.8055
  },
  {
    id: 'ckm-ind-1',
    name: 'KIADB Industrial Estate CKM',
    category: 'Commercial & Industrial',
    address: 'Bypass Road, East Chikkamagaluru 577102',
    lat: 13.3210,
    lng: 75.8020
  },

  // --- South & South-West Chikkamagaluru ---
  {
    id: 'ckm-house-1',
    name: 'KHB Housing Board Colony',
    category: 'Residential',
    address: 'Kalyananagar, South Chikkamagaluru 577101',
    lat: 13.3030,
    lng: 75.7680
  },
  {
    id: 'ckm-police-1',
    name: 'Chikkamagaluru District Police Headquarters',
    category: 'Government & Police',
    address: 'B.H. Road / Jail Road, Chikkamagaluru',
    lat: 13.3080,
    lng: 75.7710
  },
  {
    id: 'ckm-court-1',
    name: 'District Court Complex CKM',
    category: 'Government & Judicial',
    address: 'Kalyananagar Main Road, Chikkamagaluru',
    lat: 13.3065,
    lng: 75.7740
  },

  // --- West Chikkamagaluru (Mullayanagiri Gateway) ---
  {
    id: 'ckm-museum-1',
    name: 'Coffee Yatra Museum (Coffee Board of India)',
    category: 'Museum & Tourism',
    address: 'Dasarahalli Road, Chikkamagaluru 577101',
    lat: 13.3120,
    lng: 75.7530
  },
  {
    id: 'ckm-gate-1',
    name: 'Mullayanagiri - Bababudangiri Hill Gateway',
    category: 'Scenic & Route Gateway',
    address: 'Kaimara Junction Road, West Chikkamagaluru',
    lat: 13.3260,
    lng: 75.7480
  }
];

export function calculateHaversineDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const deltaPhi = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLambda = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

class PlacesService {
  /**
   * Search places using Nominatim with automatic fallback to verified Chikkamagaluru dataset
   */
  public async searchPlaces(query: string, userLocation: Coordinates = CHIKKAMAGALURU_COORDS): Promise<PlacePOI[]> {
    const cleanQuery = query.trim().toLowerCase();
    const results: PlacePOI[] = [];

    // 1. Try local verified landmarks first for fast matching
    const matchedKnown = CKM_KNOWN_PLACES.filter(place => {
      const matchName = place.name.toLowerCase().includes(cleanQuery);
      const matchCategory = place.category.toLowerCase().includes(cleanQuery);
      const matchAddr = place.address?.toLowerCase().includes(cleanQuery);
      return matchName || matchCategory || matchAddr;
    }).map(place => ({
      ...place,
      distanceMeters: calculateHaversineDistance(userLocation, { lat: place.lat, lng: place.lng })
    }));

    if (matchedKnown.length > 0) {
      results.push(...matchedKnown);
    }

    // 2. Query Nominatim OpenStreetMap API
    try {
      const searchQuery = cleanQuery.includes('karnataka') || cleanQuery.includes('bangalore') || cleanQuery.includes('chikkamagaluru')
        ? cleanQuery
        : `${cleanQuery}, Chikkamagaluru, Karnataka`;

      const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery
      )}&limit=8&addressdetails=1`;

      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'STICK-Smart-Navigation-App/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          data.forEach((item, idx) => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            const dist = calculateHaversineDistance(userLocation, { lat, lng });

            const isDuplicate = results.some(r => Math.abs(r.lat - lat) < 0.0005 && Math.abs(r.lng - lng) < 0.0005);
            if (!isDuplicate) {
              results.push({
                id: `nom-${item.place_id || idx}`,
                name: item.name || item.display_name.split(',')[0],
                category: item.type || 'Point of Interest',
                address: item.display_name,
                lat,
                lng,
                distanceMeters: dist
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[PlacesService] Remote search error, using local database:', e);
    }

    results.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    if (results.length === 0) {
      return CKM_KNOWN_PLACES.map(p => ({
        ...p,
        distanceMeters: calculateHaversineDistance(userLocation, { lat: p.lat, lng: p.lng })
      })).slice(0, 5);
    }

    return results;
  }
}

export const placesService = new PlacesService();
