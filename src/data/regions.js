// src/data/regions.js
// 권역 및 세부권역 데이터

const regionsData = [
    {
      id: 'seoul',
      name: '서울',
      subRegions: [
        { id: 'gangnam', name: '강남/서초' },
        { id: 'songpa', name: '송파/잠실' },
        { id: 'hongdae', name: '홍대/합정' },
        { id: 'itaewon', name: '이태원/한남' },
        { id: 'jongno', name: '종로/광화문' },
        { id: 'yeouido', name: '여의도/영등포' },
        { id: 'gangbuk', name: '강북/성북' },
        { id: 'dongdaemun', name: '동대문/성동' },
        { id: 'mapo', name: '마포/서대문' },
        { id: 'yeongdeungpo', name: '영등포/여의도' },
        { id: 'gwangjin', name: '광진/건대' },
        { id: 'seochon', name: '서촌/경복궁' }
      ],
      coordinates: {
        latitude: 37.5665,
        longitude: 126.9780
      }
    },
    {
      id: 'gyeonggi',
      name: '경기/인천',
      subRegions: [
        { id: 'suwon', name: '수원' },
        { id: 'seongnam', name: '성남/분당' },
        { id: 'incheon', name: '인천' },
        { id: 'yongin', name: '용인' },
        { id: 'goyang', name: '고양/일산' },
        { id: 'bucheon', name: '부천' },
        { id: 'anyang', name: '안양/군포/의왕' },
        { id: 'ansan', name: '안산' },
        { id: 'gwacheon', name: '과천/의왕' },
        { id: 'gimpo', name: '김포' },
        { id: 'gwangmyeong', name: '광명' },
        { id: 'hanam', name: '하남' }
      ],
      coordinates: {
        latitude: 37.2911,
        longitude: 127.0089
      }
    },
    {
      id: 'busan',
      name: '부산',
      subRegions: [
        { id: 'haeundae', name: '해운대/마린시티' },
        { id: 'seomyeon', name: '서면/부산진구' },
        { id: 'gwangalli', name: '광안리/수영구' },
        { id: 'nampo', name: '남포동/중구' },
        { id: 'gijang', name: '기장/해동용궁사' },
        { id: 'dongrae', name: '동래/금정구' }
      ],
      coordinates: {
        latitude: 35.1796,
        longitude: 129.0756
      }
    },
    {
      id: 'daegu',
      name: '대구',
      subRegions: [
        { id: 'dongseong', name: '동성로/중구' },
        { id: 'suseong', name: '수성구' },
        { id: 'dalseo', name: '달서구' },
        { id: 'buk', name: '북구/칠곡' }
      ],
      coordinates: {
        latitude: 35.8714,
        longitude: 128.6014
      }
    },
    {
      id: 'daejeon',
      name: '대전',
      subRegions: [
        { id: 'dunsan', name: '둔산/서구' },
        { id: 'yuseong', name: '유성구' },
        { id: 'daedeok', name: '대덕구' }
      ],
      coordinates: {
        latitude: 36.3504,
        longitude: 127.3845
      }
    },
    {
      id: 'gwangju',
      name: '광주',
      subRegions: [
        { id: 'donggu', name: '동구/충장로' },
        { id: 'seogu', name: '서구/상무지구' },
        { id: 'bukgu', name: '북구/전남대' }
      ],
      coordinates: {
        latitude: 35.1595,
        longitude: 126.8526
      }
    },
    {
      id: 'jeju',
      name: '제주',
      subRegions: [
        { id: 'jejucity', name: '제주시' },
        { id: 'jungmun', name: '중문/서귀포' },
        { id: 'seongsan', name: '성산/우도' },
        { id: 'hallim', name: '한림/협재' }
      ],
      coordinates: {
        latitude: 33.4996,
        longitude: 126.5312
      }
    },
    {
      id: 'gangwon',
      name: '강원',
      subRegions: [
        { id: 'gangneung', name: '강릉' },
        { id: 'sokcho', name: '속초/양양' },
        { id: 'pyeongchang', name: '평창/대관령' },
        { id: 'chuncheon', name: '춘천' }
      ],
      coordinates: {
        latitude: 37.8228,
        longitude: 128.1555
      }
    }
  ];
  
  // 모든 지역을 플랫하게 가져오는 함수 (검색 기능 등에 활용)
  export const getAllRegions = () => {
    const allRegions = [];
    
    regionsData.forEach(region => {
      // 대권역 추가
      allRegions.push({
        id: region.id,
        name: region.name,
        parentId: null,
        coordinates: region.coordinates
      });
      
      // 세부권역 추가
      region.subRegions.forEach(subRegion => {
        allRegions.push({
          id: subRegion.id,
          name: subRegion.name,
          parentId: region.id,
          parentName: region.name,
          coordinates: region.coordinates // 세부 좌표가 없으면 대권역 좌표 사용
        });
      });
    });
    
    return allRegions;
  };
  
  export default regionsData;
