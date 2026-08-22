// Sample service charge reference for Dubai communities.
// Values are indicative AED per sqft per year, compiled for demonstration.
// Always verify against the RERA Service Charge Index (Mollak) before quoting a client.
const SERVICE_CHARGES = {
  generated: 'sample',
  note: 'Indicative ranges — verify against the RERA Service Charge Index (Mollak) before quoting a client',
  communities: [
    { community: 'Dubai Marina', segment: 'Apartments', low: 15, typical: 18, high: 22, notes: 'Tower-dependent; marina-view towers with full amenities sit at the top of the range.' },
    { community: 'Downtown Dubai', segment: 'Apartments', low: 18, typical: 22, high: 28, notes: 'Boulevard-facing and Opera District towers command the highest rates.' },
    { community: 'Palm Jumeirah', segment: 'Apartments', low: 18, typical: 24, high: 30, notes: 'Shoreline and newer frond towers; beach access and club facilities drive costs.' },
    { community: 'JVC', segment: 'Apartments', low: 10, typical: 13, high: 16, notes: 'Wide spread between older and newer buildings; confirm chiller arrangement.' },
    { community: 'Business Bay', segment: 'Apartments', low: 13, typical: 15, high: 19, notes: 'Canal-front towers typically sit above the mid-point.' },
    { community: 'Dubai Hills Estate', segment: 'Apartments', low: 12, typical: 14, high: 17, notes: 'Park and mall proximity tiers; Emaar-managed.' },
    { community: 'Dubai Hills Estate', segment: 'Villas/Townhouses', low: 3, typical: 4.5, high: 6, notes: 'Charged on plot or built-up area depending on sub-community — verify basis.' },
    { community: 'JLT', segment: 'Apartments', low: 11, typical: 13, high: 16, notes: 'Older clusters at the low end; some towers include district cooling.' },
    { community: 'Dubai Creek Harbour', segment: 'Apartments', low: 13, typical: 15, high: 18, notes: 'Newer stock; creek-view towers trend higher.' },
    { community: 'MBR City', segment: 'Apartments', low: 12, typical: 14, high: 18, notes: 'District One and lagoon-facing buildings at the top of the range.' },
    { community: 'MBR City', segment: 'Villas/Townhouses', low: 3, typical: 4, high: 6, notes: 'Lagoon and community upkeep included; per-sqft basis varies by sub-community.' },
    { community: 'Damac Hills', segment: 'Apartments', low: 10, typical: 12, high: 14, notes: 'Golf-course community; apartments cluster around the mid-point.' },
    { community: 'Damac Hills', segment: 'Villas/Townhouses', low: 3, typical: 4, high: 5, notes: 'Covers landscaping and community facilities.' },
    { community: 'Arjan', segment: 'Apartments', low: 8, typical: 10, high: 13, notes: 'Budget-mid segment; newer buildings toward the high end.' },
    { community: 'International City', segment: 'Apartments', low: 6, typical: 8, high: 10, notes: 'Among the lowest service charges in Dubai.' },
    { community: 'Emaar Beachfront', segment: 'Apartments', low: 20, typical: 25, high: 30, notes: 'Prime waterfront with private beach access; premium tier.' },
    { community: 'Bluewaters', segment: 'Apartments', low: 20, typical: 23, high: 28, notes: 'Island community; retail and Ain Dubai upkeep reflected in rates.' },
    { community: 'City Walk', segment: 'Apartments', low: 16, typical: 19, high: 24, notes: 'Meraas-managed; low-rise premium stock.' },
    { community: 'Dubai Sports City', segment: 'Apartments', low: 8, typical: 10, high: 12, notes: 'Budget-friendly; stadium-side towers vary.' },
    { community: 'Al Furjan', segment: 'Apartments', low: 8, typical: 10, high: 12, notes: 'Mid-budget community near Ibn Battuta.' },
    { community: 'Al Furjan', segment: 'Villas/Townhouses', low: 3, typical: 4, high: 5, notes: 'Quortaj and Murooj clusters; community facilities included.' },
    { community: 'Tilal Al Ghaf', segment: 'Villas/Townhouses', low: 4, typical: 5, high: 7, notes: 'Lagoon community; newer handovers at the upper end.' },
    { community: 'Arabian Ranches 3', segment: 'Villas/Townhouses', low: 2, typical: 3, high: 4, notes: 'Emaar townhouses; among the lowest per-sqft rates for villas.' },
  ],
};
