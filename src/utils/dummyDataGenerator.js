// src/utils/dummyDataGenerator.js

/**
 * 개발용 더미 장소 데이터 생성 함수
 * 
 * @param {Number} count - 생성할 장소 개수
 * @param {Object} region - 지역 정보 {region, subRegion} (선택적)
 * @returns {Array} - 더미 장소 데이터 배열
 */
export const createDummyPlaces = (count, region = null) => {
    const regionName = region?.subRegion || region?.region || '서울';
    const categories = ['cafe', 'restaurant', 'culture', 'nature', 'activity', 'healing'];
    const interests = ['음식', '예술', '여행', '음악', '스포츠', '독서', '사진', '패션', '게임', '영화'];
    const talents = ['사진촬영', '글쓰기', '그림그리기', '노래', '춤', '요리', '운동', '액티비티', '공예'];
    const features = ['인기', '분위기 좋은', '조용한', '활기찬', '데이트', '작업하기 좋은', '인스타스팟', '가성비', '뷰 좋은', '특별한'];
    
    return Array(count).fill(null).map((_, index) => {
      // 기본 위치: 서울 중심부 주변으로 랜덤 생성
      const baseLatitude = 37.5665;
      const baseLongitude = 126.9780;
      const randomLatOffset = (Math.random() * 0.1) - 0.05; // -0.05 ~ 0.05
      const randomLngOffset = (Math.random() * 0.1) - 0.05; // -0.05 ~ 0.05
      
      // MBTI 점수 (6-9 사이의 랜덤 값)
      const generateMbtiScores = () => {
        const mbtiTypes = [
          'ENFP', 'INFP', 'ENFJ', 'INFJ',
          'ENTP', 'INTP', 'ENTJ', 'INTJ',
          'ESFP', 'ISFP', 'ESFJ', 'ISFJ',
          'ESTP', 'ISTP', 'ESTJ', 'ISTJ'
        ];
        
        const scores = {};
        mbtiTypes.forEach(type => {
          scores[type] = Math.floor(Math.random() * 4) + 6; // 6-9
        });
        
        return scores;
      };
      
      // 감정 점수 (5-9 사이의 랜덤 값)
      const generateMoodScores = () => {
        const moods = ['기쁨', '스트레스', '피곤함', '설렘', '평온함'];
        
        const scores = {};
        moods.forEach(mood => {
          scores[mood] = Math.floor(Math.random() * 5) + 5; // 5-9
        });
        
        return scores;
      };
      
      // 임의의 장소 카테고리 선택
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      // 랜덤 특성 선택 (3-5개)
      const getRandomItems = (array, min = 3, max = 5) => {
        const count = Math.floor(Math.random() * (max - min + 1)) + min;
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      };
      
      // 거리값 생성
      const distance = (index + 1) * 300; // 미터 단위
      const formattedDistance = distance < 1000 
        ? `${distance}m` 
        : `${(distance / 1000).toFixed(1)}km`;
      
      // 평점 생성 (3.5-4.9 사이)
      const rating = (3.5 + Math.random() * 1.4).toFixed(1);
      
      // 랜덤 추천 이유 선택
      const reasons = [
        'MBTI 성향에 잘 맞는 장소',
        '관심사와 관련된 장소',
        '재능을 활용할 수 있는 장소',
        '현재 감정 상태에 적합한 장소',
        '선호하는 지역 내 위치한 장소'
      ];
      const primaryReason = reasons[Math.floor(Math.random() * reasons.length)];
      
      // 이미지 생성 - 카테고리에 맞는 이미지
      const getImageUrls = (category, index) => {
        // 실제 이미지 대신 플레이스홀더 이미지 URL 반환
        return [
          `https://via.placeholder.com/400x300?text=${category}+${index+1}`,
          `https://via.placeholder.com/400x300?text=${category}+${index+1}B`,
          `https://via.placeholder.com/400x300?text=${category}+${index+1}C`
        ];
      };
      
      return {
        id: `place-${category}-${index}-${Date.now()}`,
        name: `${regionName} ${category} 추천 장소 ${index + 1}`,
        category: category,
        location: {
          latitude: baseLatitude + randomLatOffset,
          longitude: baseLongitude + randomLngOffset
        },
        coordinates: {
          latitude: baseLatitude + randomLatOffset,
          longitude: baseLongitude + randomLngOffset
        },
        distance: distance,
        formattedDistance: formattedDistance,
        rating: parseFloat(rating),
        photos: getImageUrls(category, index),
        thumbnail: `https://via.placeholder.com/150?text=${category}+${index+1}`,
        description: `이 장소는 ${regionName}에 위치한 ${category} 카테고리의 추천 장소입니다. 다양한 특징과 분위기를 즐길 수 있습니다.`,
        specialFeatures: getRandomItems(features),
        interestTags: getRandomItems(interests),
        talentRelevance: getRandomItems(talents, 1, 3),
        mbtiMatchScore: generateMbtiScores(),
        moodMatchScore: generateMoodScores(),
        matchScore: 70 + Math.floor(Math.random() * 20), // 70-89
        primaryReason: primaryReason,
        matchDetails: {
          mbtiScore: 6 + Math.floor(Math.random() * 3), // 6-8
          interestScore: 6 + Math.floor(Math.random() * 3), // 6-8
          talentScore: 5 + Math.floor(Math.random() * 4), // 5-8
          moodScore: 6 + Math.floor(Math.random() * 3), // 6-8
          locationScore: 7 + Math.floor(Math.random() * 3) // 7-9
        },
        averageRating: {
          overall: parseFloat(rating),
          byMbtiType: {
            'ENFP': (3.0 + Math.random() * 2.0).toFixed(1),
            'INFP': (3.0 + Math.random() * 2.0).toFixed(1),
            'ENTJ': (3.0 + Math.random() * 2.0).toFixed(1)
          }
        },
        region: region?.region || '서울',
        subRegion: region?.subRegion || ['강남/서초', '홍대/합정', '이태원/한남'][index % 3]
      };
    });
  };
  
  // 명명된 객체로 내보내기
  const dummyDataGenerator = {
    createDummyPlaces
  };
  
  export default dummyDataGenerator;
