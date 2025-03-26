// 사용자 프로필 타입
export const UserProfile = {
    id: '',
    mbti: '',
    interests: [],
    customInterests: [],
    talents: [],
    preferredLocations: [],
    currentMood: null,
    savedPlaces: []
  };
  
  // 선호 지역 타입
  export const PreferredLocation = {
    name: '',
    coordinates: {
      latitude: 0,
      longitude: 0
    },
    region: '',
    subRegion: ''
  };
  
  // 장소 타입
  export const Place = {
    placeId: '',
    name: '',
    location: {
      latitude: 0,
      longitude: 0
    },
    region: '',
    subRegion: '',
    category: '',
    subCategory: '',
    mbtiMatchScore: {},
    interestTags: [],
    talentRelevance: [],
    moodMatchScore: {},
    photos: [],
    description: '',
    operatingHours: {},
    contactInfo: {},
    priceLevel: 0,
    averageRating: {
      overall: 0,
      byMbtiType: {}
    },
    reviewCount: 0,
    specialFeatures: []
  };
