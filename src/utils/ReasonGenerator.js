/**
 * src/utils/ReasonGenerator.js
 * 사용자 프로필과 장소 데이터를 기반으로 추천 이유를 생성하는 유틸리티 함수
 */

/**
 * MBTI 기반 추천 이유 생성
 * @param {string} mbtiType - 사용자의 MBTI 유형 (예: 'ENFP', 'ISTJ')
 * @param {Object} place - 장소 데이터
 * @returns {Object} 추천 이유 객체
 */
export const generateMbtiReason = (mbtiType, place) => {
  if (!mbtiType || !place || !place.mbtiMatchScore) {
    return null;
  }

  const score = place.mbtiMatchScore[mbtiType] || 0;
  if (score < 7) {
    return null; // 점수가 낮으면 추천 이유 생성하지 않음
  }

  const reasons = {
    title: `MBTI: ${mbtiType}`,
    score: score,
    points: []
  };

  // 각 MBTI 유형별 특성에 맞는 추천 이유 생성
  const mbtiTraits = getMbtiTraits(mbtiType);

  // 에너지 방향 (E/I)
  if (mbtiType[0] === 'E') {
    reasons.points.push(`${mbtiType}의 사교적인 성향에 맞는 ${mbtiTraits.energyDirection} 분위기를 제공합니다.`);
  } else {
    reasons.points.push(`${mbtiType}의 내향적 성향에 맞는 ${mbtiTraits.energyDirection} 공간입니다.`);
  }

  // 인식 기능 (S/N)
  if (mbtiType[1] === 'S') {
    reasons.points.push(`감각적인 ${mbtiType} 성향의 당신을 위한 ${mbtiTraits.informationProcessing} 환경입니다.`);
  } else {
    reasons.points.push(`직관적인 ${mbtiType} 성향의 당신을 위한 ${mbtiTraits.informationProcessing} 경험을 제공합니다.`);
  }

  // 판단 기능 (T/F)
  if (mbtiType[2] === 'T') {
    reasons.points.push(`논리적인 ${mbtiType} 성향과 어울리는 ${mbtiTraits.decisionMaking} 특징이 있습니다.`);
  } else {
    reasons.points.push(`감성적인 ${mbtiType} 성향에 맞는 ${mbtiTraits.decisionMaking} 요소가 있습니다.`);
  }

  // 생활 양식 (J/P)
  if (mbtiType[3] === 'J') {
    reasons.points.push(`계획적인 ${mbtiType} 성향에 적합한 ${mbtiTraits.lifestyle} 환경을 제공합니다.`);
  } else {
    reasons.points.push(`유연한 ${mbtiType} 성향에 맞는 ${mbtiTraits.lifestyle} 공간입니다.`);
  }

  // 장소 특성과 관련된 추가 이유 (있는 경우)
  if (place.specialFeatures && place.specialFeatures.length > 0) {
    const relevantFeatures = filterRelevantFeatures(place.specialFeatures, mbtiType);
    if (relevantFeatures.length > 0) {
      reasons.points.push(`이 장소의 ${relevantFeatures.join(', ')} 특성이 ${mbtiType} 성향과 잘 어울립니다.`);
    }
  }

  return reasons;
};

/**
 * 관심사 기반 추천 이유 생성
 * @param {Array<string>} userInterests - 사용자의 관심사 목록
 * @param {Array<string>} userCustomInterests - 사용자가 직접 입력한 관심사 목록
 * @param {Object} place - 장소 데이터
 * @returns {Object} 추천 이유 객체
 */
export const generateInterestReason = (userInterests, userCustomInterests, place) => {
  if (!userInterests || !place || !place.interestTags) {
    return null;
  }

  const allInterests = [...(userInterests || []), ...(userCustomInterests || [])];
  if (allInterests.length === 0) {
    return null;
  }

  const matchingInterests = allInterests.filter(interest => 
    place.interestTags.includes(interest)
  );

  if (matchingInterests.length === 0) {
    return null;
  }

  const reasons = {
    title: `관심사: ${matchingInterests.join(', ')}`,
    score: (matchingInterests.length / Math.max(1, allInterests.length)) * 10,
    points: []
  };

  // 각 관심사별 맞춤 추천 이유 생성
  matchingInterests.forEach(interest => {
    switch(interest) {
      case '음식':
        reasons.points.push(`음식에 관심이 많은 당신을 위한 특별한 메뉴와 맛의 경험을 제공합니다.`);
        break;
      case '예술':
      case '아트':
        reasons.points.push(`예술에 관심이 많은 당신을 위한 독특한 인테리어와 예술적 요소가 있습니다.`);
        break;
      case '음악':
        reasons.points.push(`음악에 관심이 많은 당신을 위한 좋은 음향과 분위기를 제공합니다.`);
        break;
      case '여행':
        reasons.points.push(`여행을 좋아하는 당신에게 새로운 경험과 발견의 기회를 제공합니다.`);
        break;
      case '자연':
        reasons.points.push(`자연을 좋아하는 당신을 위한 자연 요소가 조화롭게 어우러진 공간입니다.`);
        break;
      case '카페':
      case '커피':
        reasons.points.push(`커피와 카페에 관심 있는 당신을 위한 특별한 원두와 분위기를 제공합니다.`);
        break;
      case '책':
      case '독서':
        reasons.points.push(`독서를 좋아하는 당신을 위한 편안한 환경과 분위기가 마련되어 있습니다.`);
        break;
      case '사진':
      case '사진촬영':
        reasons.points.push(`사진 촬영에 관심 있는 당신을 위한 포토스팟과 독특한 공간이 있습니다.`);
        break;
      default:
        reasons.points.push(`${interest}에 관심이 있는 당신이 즐길 수 있는 요소가 있습니다.`);
    }
  });

  // 중복 제거 (동일한 추천 이유가 여러 번 생성될 수 있음)
  reasons.points = [...new Set(reasons.points)];

  return reasons;
};

/**
 * 재능 기반 추천 이유 생성
 * @param {Array<string>} userTalents - 사용자의 재능 목록
 * @param {Object} place - 장소 데이터
 * @returns {Object} 추천 이유 객체
 */
export const generateTalentReason = (userTalents, place) => {
  if (!userTalents || !place || !place.talentRelevance) {
    return null;
  }

  const matchingTalents = userTalents.filter(talent => 
    place.talentRelevance.includes(talent)
  );

  if (matchingTalents.length === 0) {
    return null;
  }

  const reasons = {
    title: `재능: ${matchingTalents.join(', ')}`,
    score: (matchingTalents.length / Math.max(1, userTalents.length)) * 10,
    points: []
  };

  // 각 재능별 맞춤 추천 이유 생성
  matchingTalents.forEach(talent => {
    switch(talent) {
      case '사진촬영':
        reasons.points.push(`사진 찍기를 좋아하는 당신을 위한 인스타그래머블한 장소입니다.`);
        reasons.points.push(`독특한 조명과 인테리어가 멋진 사진의 배경이 됩니다.`);
        break;
      case '글쓰기':
        reasons.points.push(`글쓰기에 재능이 있는 당신을 위한 영감을 주는 조용한 공간입니다.`);
        break;
      case '그림그리기':
      case '그림':
      case '드로잉':
        reasons.points.push(`그림 그리는 당신에게 영감을 줄 수 있는 시각적 요소가 풍부합니다.`);
        break;
      case '요리':
      case '베이킹':
        reasons.points.push(`요리에 재능이 있는 당신이 새로운 아이디어를 얻을 수 있는 메뉴와 분위기를 제공합니다.`);
        break;
      case '운동':
      case '스포츠':
        reasons.points.push(`운동을 즐기는 당신을 위한 활동적인 경험이나 건강한 옵션이 있습니다.`);
        break;
      case '음악':
      case '악기연주':
        reasons.points.push(`음악적 재능이 있는 당신이 즐길 수 있는 음향과 분위기를 제공합니다.`);
        break;
      case '춤':
      case '댄스':
        reasons.points.push(`춤을 좋아하는 당신이 리듬을 느낄 수 있는 활기찬 공간입니다.`);
        break;
      default:
        reasons.points.push(`${talent} 재능을 발휘하거나 즐길 수 있는 장소입니다.`);
    }
  });

  // 중복 제거
  reasons.points = [...new Set(reasons.points)];

  return reasons;
};

/**
 * 감정 상태 기반 추천 이유 생성
 * @param {Object} currentMood - 사용자의 현재 감정 상태 객체
 * @param {Object} place - 장소 데이터
 * @returns {Object} 추천 이유 객체
 */
export const generateMoodReason = (currentMood, place) => {
  if (!currentMood || !currentMood.mood || !place || !place.moodMatchScore) {
    return null;
  }

  const mood = currentMood.mood;
  const score = place.moodMatchScore[mood] || 0;

  if (score < 7) {
    return null; // 점수가 낮으면 추천 이유 생성하지 않음
  }

  const reasons = {
    title: `현재 감정: ${mood}`,
    score: score,
    points: []
  };

  // 각 감정 상태별 맞춤 추천 이유 생성
  switch(mood) {
    case '기쁨':
      reasons.points.push(`기분 좋은 오늘, 당신의 긍정적인 에너지를 더욱 높여줄 활기찬 장소입니다.`);
      reasons.points.push(`즐거운 감정을 나눌 수 있는 밝고 활기찬 분위기가 있습니다.`);
      break;
    case '스트레스':
      reasons.points.push(`스트레스를 느끼는 지금, 마음의 안정을 찾을 수 있는 편안한 공간입니다.`);
      reasons.points.push(`복잡한 생각을 잠시 내려놓고 휴식할 수 있는 분위기를 제공합니다.`);
      break;
    case '피곤함':
      reasons.points.push(`피곤한 지금, 에너지를 충전할 수 있는 편안한 분위기의 장소입니다.`);
      reasons.points.push(`부담 없이 쉬어갈 수 있는 편안한 좌석과 조용한 환경이 있습니다.`);
      break;
    case '설렘':
      reasons.points.push(`설레는 마음을 더욱 특별하게 만들어줄 로맨틱한 분위기의 장소입니다.`);
      reasons.points.push(`특별한 시간을 보내기에 완벽한 분위기와 서비스를 제공합니다.`);
      break;
    case '평온함':
      reasons.points.push(`평온한 마음을 유지하며 여유롭게 시간을 보낼 수 있는 안정적인 공간입니다.`);
      reasons.points.push(`고요함과 안정감을 느낄 수 있는 조화로운 환경을 제공합니다.`);
      break;
    default:
      reasons.points.push(`현재 감정 상태에 적합한 분위기와 환경을 제공합니다.`);
  }

  // 장소 특성과 관련된 추가 이유 (있는 경우)
  if (place.specialFeatures && place.specialFeatures.length > 0) {
    const relevantFeatures = filterRelevantMoodFeatures(place.specialFeatures, mood);
    if (relevantFeatures.length > 0) {
      reasons.points.push(`이 장소의 ${relevantFeatures.join(', ')} 특성이 현재 감정 상태에 적합합니다.`);
    }
  }

  return reasons;
};

/**
 * 통합 추천 이유 생성 - 모든 요소를 종합적으로 고려
 * @param {Object} user - 사용자 프로필 데이터
 * @param {Object} place - 장소 데이터
 * @returns {Object} 통합된 추천 이유 객체
 */
export const generateAllReasons = (user, place) => {
  if (!user || !place) {
    return null;
  }

  const result = {};

  // MBTI 기반 추천 이유
  if (user.mbti) {
    const mbtiReason = generateMbtiReason(user.mbti, place);
    if (mbtiReason) {
      result.mbti = mbtiReason;
    }
  }

  // 관심사 기반 추천 이유
  if (user.interests || user.customInterests) {
    const interestReason = generateInterestReason(user.interests, user.customInterests, place);
    if (interestReason) {
      result.interests = interestReason;
    }
  }

  // 재능 기반 추천 이유
  if (user.talents) {
    const talentReason = generateTalentReason(user.talents, place);
    if (talentReason) {
      result.talents = talentReason;
    }
  }

  // 감정 상태 기반 추천 이유
  if (user.currentMood) {
    const moodReason = generateMoodReason(user.currentMood, place);
    if (moodReason) {
      result.mood = moodReason;
    }
  }

  return result;
};

/**
 * 주요 추천 이유 찾기 (점수가 가장 높은 추천 이유)
 * @param {Object} allReasons - 모든 추천 이유 객체
 * @returns {string} 주요 추천 이유 카테고리 (mbti, interests, talents, mood)
 */
export const findPrimaryReasonCategory = (allReasons) => {
  if (!allReasons) return null;

  let maxScore = 0;
  let primaryCategory = null;

  for (const [category, reason] of Object.entries(allReasons)) {
    if (reason.score > maxScore) {
      maxScore = reason.score;
      primaryCategory = category;
    }
  }

  return primaryCategory;
};

/**
 * 주요 추천 이유 텍스트 생성
 * @param {Object} matchDetails - 매칭 상세 정보
 * @param {Object} userProfile - 사용자 프로필
 * @returns {string} 주요 추천 이유 텍스트
 */
export const generatePrimaryReason = (matchDetails, userProfile) => {
  const maxScoreCategory = Object.entries(matchDetails)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  switch (maxScoreCategory) {
    case 'mbtiScore': 
      return `${userProfile.mbti} 성향에 잘 맞는 장소`;
    case 'interestScore': 
      return "관심사와 관련된 장소";
    case 'talentScore': 
      return "재능을 활용할 수 있는 장소";
    case 'moodScore': 
      return "현재 감정 상태에 적합한 장소";
    case 'locationScore': 
      return "선호하는 지역 내 위치";
    default: 
      return "종합적으로 추천하는 장소";
  }
};

// 헬퍼 함수들

/**
 * MBTI 유형별 특성 정보 가져오기
 * @param {string} mbtiType - MBTI 유형
 * @returns {Object} MBTI 특성 객체
 */
const getMbtiTraits = (mbtiType) => {
  const traits = {
    energyDirection: '',
    informationProcessing: '',
    decisionMaking: '',
    lifestyle: ''
  };

  // 에너지 방향 (E/I)
  if (mbtiType[0] === 'E') {
    traits.energyDirection = '활기차고 사교적인';
  } else {
    traits.energyDirection = '조용하고 차분한';
  }

  // 인식 기능 (S/N)
  if (mbtiType[1] === 'S') {
    traits.informationProcessing = '실용적이고 구체적인';
  } else {
    traits.informationProcessing = '독창적이고 새로운';
  }

  // 판단 기능 (T/F)
  if (mbtiType[2] === 'T') {
    traits.decisionMaking = '논리적이고 체계적인';
  } else {
    traits.decisionMaking = '따뜻하고 조화로운';
  }

  // 생활 양식 (J/P)
  if (mbtiType[3] === 'J') {
    traits.lifestyle = '체계적이고 계획된';
  } else {
    traits.lifestyle = '유연하고 자유로운';
  }

  return traits;
};

/**
 * MBTI 유형에 적합한 장소 특성 필터링
 * @param {Array<string>} features - 장소 특성 목록
 * @param {string} mbtiType - MBTI 유형
 * @returns {Array<string>} 관련 있는 특성 목록
 */
const filterRelevantFeatures = (features, mbtiType) => {
  // 각 MBTI 유형에 관련성이 높은 특성들
  const mbtiPreferences = {
    // 외향형
    E: ['활기찬', '사람이 많은', '소셜', '이벤트', '그룹 활동'],
    // 내향형
    I: ['조용한', '한적한', '프라이빗', '독립적', '작업하기 좋은'],
    // 감각형
    S: ['전통적인', '실용적인', '안정적인', '정돈된'],
    // 직관형
    N: ['독특한', '창의적인', '비주류', '실험적인', '신선한'],
    // 사고형
    T: ['효율적인', '기능적인', '논리적인', '미니멀'],
    // 감정형
    F: ['따뜻한', '감성적인', '아기자기한', '로맨틱한'],
    // 판단형
    J: ['체계적인', '질서정연한', '계획된', '예측 가능한'],
    // 인식형
    P: ['자유로운', '즉흥적인', '유연한', '다양한']
  };

  // MBTI 유형에 맞는 특성 선호도 가져오기
  const relevantPreferences = [];
  for (let i = 0; i < mbtiType.length; i++) {
    relevantPreferences.push(...mbtiPreferences[mbtiType[i]]);
  }

  // 장소 특성 중 MBTI 선호도와 관련 있는 것들 필터링
  return features.filter(feature => 
    relevantPreferences.some(pref => 
      feature.toLowerCase().includes(pref.toLowerCase())
    )
  );
};

/**
 * 감정 상태에 적합한 장소 특성 필터링
 * @param {Array<string>} features - 장소 특성 목록
 * @param {string} mood - 감정 상태
 * @returns {Array<string>} 관련 있는 특성 목록
 */
const filterRelevantMoodFeatures = (features, mood) => {
  // 각 감정 상태에 관련성이 높은 특성들
  const moodPreferences = {
    '기쁨': ['활기찬', '밝은', '즐거운', '파티', '축하'],
    '스트레스': ['조용한', '한적한', '편안한', '휴식', '힐링'],
    '피곤함': ['편안한', '차분한', '아늑한', '휴식', '충전'],
    '설렘': ['로맨틱한', '특별한', '분위기 있는', '이색적인'],
    '평온함': ['고요한', '안정적인', '여유로운', '자연 친화적인']
  };

  const relevantPreferences = moodPreferences[mood] || [];

  // 장소 특성 중 감정 상태 선호도와 관련 있는 것들 필터링
  return features.filter(feature => 
    relevantPreferences.some(pref => 
      feature.toLowerCase().includes(pref.toLowerCase())
    )
  );
};
