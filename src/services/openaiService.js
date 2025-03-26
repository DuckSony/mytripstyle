// src/services/openaiService.js

import { db } from '../config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

// 환경 변수 및 설정
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
const OPENAI_API_URL = process.env.REACT_APP_OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.REACT_APP_OPENAI_API_MODEL || 'gpt-3.5-turbo';
const CACHE_DURATION = parseInt(process.env.REACT_APP_CACHE_DURATION || '86400000'); // 기본 24시간
const isEnabled = process.env.REACT_APP_FEATURE_AI_RECOMMENDATIONS === 'true';

/**
 * OpenAI API 호출 함수
 * 
 * @param {Array} messages - OpenAI API에 전송할 메시지 배열
 * @param {number} temperature - 응답 다양성 조절 (0: 결정적, 1: 창의적)
 * @param {number} maxTokens - 최대 토큰 수
 * @returns {Promise<string|null>} - API 응답 또는 오류 시 null
 */
export const callOpenAI = async (messages, temperature = 0.7, maxTokens = 500) => {
  if (!isEnabled || !OPENAI_API_KEY) {
    console.warn('[OpenAI] API 키가 없거나 기능이 비활성화되었습니다.');
    return null;
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API 오류: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('[OpenAI] API 호출 실패:', error);
    return null;
  }
};

/**
 * 캐시에서 추천 이유 확인 또는 생성 및 캐싱
 * 
 * @param {string} cacheId - 캐시 식별자
 * @param {Function} generatorFn - 추천 이유 생성 함수
 * @returns {Promise<string>} - 추천 이유 텍스트
 */
const getOrCreateRecommendation = async (cacheId, generatorFn) => {
  try {
    // 캐시 확인
    const cacheRef = doc(db, 'aiRecommendations', cacheId);
    const cacheSnapshot = await getDoc(cacheRef);
    
    if (cacheSnapshot.exists()) {
      const cachedData = cacheSnapshot.data();
      const cacheTime = cachedData.timestamp?.toDate?.() || new Date(cachedData.timestamp);
      
      // 캐시가 유효한지 확인
      if ((new Date() - cacheTime) < CACHE_DURATION) {
        console.log(`[OpenAI] 캐시에서 추천 이유 로드: ${cacheId}`);
        return cachedData.recommendation;
      }
    }
    
    // 캐시가 없거나 만료된 경우 새로 생성
    const recommendation = await generatorFn();
    
    if (recommendation) {
      // 캐시에 저장
      await setDoc(cacheRef, {
        recommendation,
        timestamp: new Date(),
        cacheId
      });
    }
    
    return recommendation;
  } catch (error) {
    console.error('[OpenAI] 추천 이유 가져오기 실패:', error);
    return null;
  }
};

/**
 * MBTI 유형 기반 추천 이유 생성
 * 
 * @param {string} mbtiType - 사용자 MBTI 유형
 * @param {Object} placeData - 장소 데이터
 * @returns {Promise<string>} - 추천 이유 텍스트
 */
export const generateMbtiBasedRecommendation = async (mbtiType, placeData) => {
  const cacheId = `mbti_${mbtiType}_${placeData.id}`;
  
  return getOrCreateRecommendation(cacheId, async () => {
    const messages = [
      {
        role: 'system',
        content: `당신은 MBTI 유형별 성향에 맞는 장소를 추천하는 여행 전문가입니다. ${mbtiType} 유형의 사용자에게 맞춤형 추천 이유를 제공해주세요. 150-200자 내외로 자연스러운 대화체로 작성해주세요. 과장된 표현은 피하고 구체적인 이유와 장소의 특별한 점을 언급해주세요.`
      },
      {
        role: 'user',
        content: `${mbtiType} 유형의 사용자에게 다음 장소를 추천하는 이유를 작성해주세요. 
장소 정보: 
- 이름: ${placeData.name}
- 카테고리: ${placeData.category || '정보 없음'}
- 특징: ${placeData.specialFeatures?.join(', ') || '정보 없음'}
- 지역: ${placeData.subRegion || placeData.region || '정보 없음'}`
      }
    ];
    
    const fallbackMessages = [
      `${mbtiType} 성향의 당신에게 ${placeData.name}의 특별한 분위기가 잘 맞을 것 같습니다.`,
      `${mbtiType} 유형의 사람들이 좋아하는 요소들이 이 장소에 많이 있습니다.`,
      `${mbtiType} 성향을 가진 당신이라면 이 장소의 특별한 분위기를 즐길 수 있을 것입니다.`
    ];
    
    const result = await callOpenAI(messages, 0.7);
    return result || fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
  });
};

/**
 * 감정 상태 기반 추천 이유 생성
 * 
 * @param {string} mood - 사용자 감정 상태
 * @param {Object} placeData - 장소 데이터
 * @returns {Promise<string>} - 추천 이유 텍스트
 */
export const generateMoodBasedRecommendation = async (mood, placeData) => {
  const cacheId = `mood_${mood}_${placeData.id}`;
  
  return getOrCreateRecommendation(cacheId, async () => {
    const messages = [
      {
        role: 'system',
        content: `당신은 사용자의 감정 상태에 맞는 장소를 추천하는 감성 전문가입니다. ${mood} 상태의 사용자에게 맞춤형 추천 이유를 제공해주세요. 150-200자 내외로 공감적이고 자연스러운 대화체로 작성해주세요.`
      },
      {
        role: 'user',
        content: `${mood} 상태의 사용자에게 다음 장소를 추천하는 이유를 작성해주세요.
장소 정보:
- 이름: ${placeData.name}
- 카테고리: ${placeData.category || '정보 없음'}
- 특징: ${placeData.specialFeatures?.join(', ') || '정보 없음'}
- 지역: ${placeData.subRegion || placeData.region || '정보 없음'}`
      }
    ];
    
    const fallbackMessages = {
      '기쁨': `기분 좋은 지금, ${placeData.name}에서 그 기분을 더욱 높여보세요.`,
      '스트레스': `스트레스를 느끼는 지금, ${placeData.name}에서 잠시 휴식을 취해보세요.`,
      '피곤함': `피곤함을 느끼는 당신에게 ${placeData.name}의 편안한 분위기가 도움이 될 거예요.`,
      '설렘': `설레는 마음을 간직한 채 ${placeData.name}의 특별한 분위기를 경험해보세요.`,
      '평온함': `평온한 마음을 유지하며 ${placeData.name}에서 여유로운 시간을 보내보세요.`
    };
    
    const result = await callOpenAI(messages, 0.8);
    return result || fallbackMessages[mood] || `${mood} 감정을 느끼는 지금, 이 장소가 도움이 될 것입니다.`;
  });
};

/**
 * 관심사 기반 추천 이유 생성
 * 
 * @param {Array} interests - 사용자 관심사 배열
 * @param {Object} placeData - 장소 데이터
 * @returns {Promise<string>} - 추천 이유 텍스트
 */
export const generateInterestBasedRecommendation = async (interests, placeData) => {
  // 장소와 관련된 관심사 찾기
  const relevantInterests = interests.filter(interest => 
    placeData.interestTags?.includes(interest)
  );
  
  if (relevantInterests.length === 0) {
    return `이 장소는 당신의 다양한 관심사를 충족시켜줄 수 있는 곳입니다.`;
  }
  
  const cacheId = `interests_${relevantInterests.join('_')}_${placeData.id}`;
  
  return getOrCreateRecommendation(cacheId, async () => {
    const messages = [
      {
        role: 'system',
        content: `당신은 사용자의 관심사에 맞는 장소를 추천하는 전문가입니다. 관심사(${relevantInterests.join(', ')})가 있는 사용자에게 맞춤형 추천 이유를 제공해주세요. 150-200자 내외로 구체적이고 자연스러운 대화체로 작성해주세요.`
      },
      {
        role: 'user',
        content: `${relevantInterests.join(', ')} 관심사를 가진 사용자에게 다음 장소를 추천하는 이유를 작성해주세요.
장소 정보:
- 이름: ${placeData.name}
- 카테고리: ${placeData.category || '정보 없음'}
- 특징: ${placeData.specialFeatures?.join(', ') || '정보 없음'}
- 관련 태그: ${placeData.interestTags?.join(', ') || '정보 없음'}`
      }
    ];
    
    const result = await callOpenAI(messages, 0.7);
    
    if (result) return result;
    
    // 폴백 메시지
    return `${relevantInterests.join(', ')}에 관심이 있는 당신에게 이 장소는 특별한 경험을 제공할 것입니다.`;
  });
};

/**
 * 비슷한 장소 추천 가져오기
 * 
 * @param {Object} placeData - 현재 장소 데이터
 * @param {number} limit - 가져올 장소 수
 * @returns {Promise<Array>} - 추천 장소 배열
 */
export const getSimilarPlaceRecommendations = async (placeData, maxCount = 3) => {
  try {
    // 카테고리 또는 태그 기반으로 유사한 장소 검색
    const placesRef = collection(db, 'places');
    
    let similarPlacesQuery;
    
    if (placeData.category) {
      similarPlacesQuery = query(
        placesRef,
        where('category', '==', placeData.category),
        where('id', '!=', placeData.id),
        limit(maxCount * 2) // 필터링을 위해 더 많이 가져옴
      );
    } else if (placeData.interestTags && placeData.interestTags.length > 0) {
      // 첫 번째 태그를 기준으로 검색
      similarPlacesQuery = query(
        placesRef,
        where('interestTags', 'array-contains', placeData.interestTags[0]),
        where('id', '!=', placeData.id),
        limit(maxCount * 2)
      );
    } else {
      // 기준이 없는 경우
      return [];
    }
    
    const querySnapshot = await getDocs(similarPlacesQuery);
    
    if (querySnapshot.empty) {
      return [];
    }
    
    const places = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 유사도 점수 계산 및 정렬
    const scoredPlaces = places.map(place => {
      let score = 0;
      
      // 카테고리 일치 점수
      if (place.category === placeData.category) {
        score += 5;
      }
      
      // 하위 카테고리 일치 점수
      if (place.subCategory === placeData.subCategory) {
        score += 3;
      }
      
      // 지역 일치 점수
      if (place.region === placeData.region) {
        score += 2;
      }
      
      if (place.subRegion === placeData.subRegion) {
        score += 3;
      }
      
      // 태그 일치 점수
      const commonTags = placeData.interestTags?.filter(tag => 
        place.interestTags?.includes(tag)
      ) || [];
      
      score += commonTags.length * 2;
      
      // 특별 기능 일치 점수
      const commonFeatures = placeData.specialFeatures?.filter(feature => 
        place.specialFeatures?.includes(feature)
      ) || [];
      
      score += commonFeatures.length * 1.5;
      
      return { ...place, similarityScore: score };
    });
    
    // 점수로 정렬하고 상위 N개 선택
    return scoredPlaces
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, maxCount);
    
  } catch (error) {
    console.error('[OpenAI] 유사 장소 추천 가져오기 실패:', error);
    return [];
  }
};

/**
 * 맞춤형 여행 계획 생성
 * 
 * @param {Object} userData - 사용자 데이터 (MBTI, 관심사 등)
 * @param {Object} params - 여행 계획 매개변수 (지역, 기간 등)
 * @returns {Promise<Object|null>} - 여행 계획 객체 또는 오류 시 null
 */
export const generateCustomTravelPlan = async (userData, params) => {
  if (!isEnabled || !OPENAI_API_KEY) {
    return null;
  }
  
  try {
    const { mbti, interests, talents } = userData;
    const { region, duration, budget, preferredActivities } = params;
    
    const messages = [
      {
        role: 'system',
        content: `당신은 개인화된 여행 계획을 만드는 전문가입니다. MBTI, 관심사, 재능 등 사용자 정보를 기반으로 맞춤형 여행 일정을 만들어주세요. 구체적인 장소와 활동을 포함해야 합니다.`
      },
      {
        role: 'user',
        content: `다음 정보를 바탕으로 맞춤형 여행 계획을 만들어주세요:
사용자 정보:
- MBTI: ${mbti || '정보 없음'}
- 관심사: ${interests?.join(', ') || '정보 없음'}
- 재능: ${talents?.join(', ') || '정보 없음'}

여행 조건:
- 지역: ${region}
- 기간: ${duration} 일
- 예산: ${budget || '제한 없음'}
- 선호 활동: ${preferredActivities?.join(', ') || '정보 없음'}`
      }
    ];
    
    const response = await callOpenAI(messages, 0.8, 1500);
    
    if (!response) {
      return null;
    }
    
    // JSON 형식으로 파싱 시도
    try {
      // 응답에서 JSON 부분만 추출 시도
      const jsonMatches = response.match(/```json\n([\s\S]*?)\n```/) || 
                          response.match(/\{[\s\S]*\}/);
      
      const jsonStr = jsonMatches ? jsonMatches[1] || jsonMatches[0] : response;
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.warn('[OpenAI] JSON 파싱 실패, 텍스트 응답 반환:', parseError);
      
      // 텍스트 응답 그대로 반환
      return {
        plan: response,
        isRawText: true
      };
    }
  } catch (error) {
    console.error('[OpenAI] 여행 계획 생성 실패:', error);
    return null;
  }
};

export default {
  callOpenAI,
  generateMbtiBasedRecommendation,
  generateMoodBasedRecommendation,
  generateInterestBasedRecommendation,
  getSimilarPlaceRecommendations,
  generateCustomTravelPlan
};
