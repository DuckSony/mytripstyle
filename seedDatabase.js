// seedDatabase.js
// Firebase에 MyTripStyle의 테스트 데이터를 생성하기 위한 스크립트

// Firebase 설정 import - Node.js 환경에서는 require 사용
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection,
  doc, 
  setDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
  GeoPoint 
} = require('firebase/firestore');

// Firebase 설정 객체
const firebaseConfig = {
  apiKey: "AIzaSyAvcLvkvpboz5udXpy7jrSCyaUpWNYfTUA",
  authDomain: "dailytrip-8f168.firebaseapp.com",
  projectId: "dailytrip-8f168",
  storageBucket: "dailytrip-8f168.appspot.com",
  messagingSenderId: "627112795738",
  appId: "1:627112795738:web:167800fd22e7ee69168263"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 작업 상태 추적 변수
let totalOperations = 0;
let successfulOperations = 0;
let failedOperations = 0;

// 작업 결과 출력
function printResults() {
  console.log('\n===== 데이터베이스 시드 작업 결과 =====');
  console.log(`총 작업 수: ${totalOperations}`);
  console.log(`성공: ${successfulOperations}`);
  console.log(`실패: ${failedOperations}`);
  console.log('=======================================\n');
}

// 데이터 생성 함수
async function seedDatabase() {
  try {
    console.log('데이터베이스 시드 작업을 시작합니다...');
    
    // 장소 데이터 생성
    await createPlaces();
    
    // 테스트 사용자 생성
    await createTestUsers();
    
    // 테스트 리뷰 생성
    await createTestReviews();
    
    // 테스트 저장된 장소 생성
    await createTestSavedPlaces();
    
    // 테스트 방문 계획 및 기록 생성
    await createTestVisits();
    
    console.log('데이터베이스 시드 작업이 성공적으로 완료되었습니다!');
    printResults();
  } catch (error) {
    console.error('데이터베이스 시드 작업 중 오류가 발생했습니다:', error);
    printResults();
  }
}

// 장소 데이터 생성 함수
async function createPlaces() {
  console.log('장소 데이터를 생성합니다...');
  
  // 장소 데이터 배열
  const places = [
    {
      id: "gangnam-coffee-1",
      placeId: "gangnam-coffee-1", // 앱에서 id와 placeId 모두 사용하므로 둘 다 설정
      name: "스타일리쉬 커피 강남점",
      description: "강남역 인근에 위치한 세련된 분위기의 카페입니다. 다양한 원두로 만든 스페셜티 커피를 맛볼 수 있습니다.",
      location: { 
        latitude: 37.498095,
        longitude: 127.027610
      },
      address: "서울특별시 강남구 강남대로 123",
      region: "서울",
      subRegion: "강남/서초",
      category: "cafe",
      photos: [
        "https://via.placeholder.com/800x600?text=Cafe+Interior",
        "https://via.placeholder.com/800x600?text=Coffee+Menu"
      ],
      thumbnail: "https://via.placeholder.com/400x300?text=Cafe+Thumbnail",
      mbtiMatchScore: {
        "ENFJ": 8, "ENFP": 9, "ENTJ": 7, "ENTP": 8,
        "ESFJ": 7, "ESFP": 8, "ESTJ": 6, "ESTP": 7,
        "INFJ": 8, "INFP": 9, "INTJ": 7, "INTP": 8,
        "ISFJ": 6, "ISFP": 7, "ISTJ": 5, "ISTP": 6
      },
      interestTags: ["커피", "카페", "디저트", "작업"],
      talentRelevance: ["사진촬영", "글쓰기", "디자인"],
      moodMatchScore: {
        "기쁨": 8, "스트레스": 4, "피곤함": 5, "설렘": 9, "평온함": 7
      },
      averageRating: 4.5,
      reviewCount: 128,
      priceLevel: 3,
      operatingHours: {
        weekday: "09:00-22:00",
        weekend: "10:00-22:00"
      },
      contactInfo: {
        phone: "02-1234-5678",
        website: "https://example.com/cafe",
        instagram: "@stylishcoffee"
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    // ... 기타 장소 데이터 (이전과 동일)
  ];
  
  // 장소 데이터 Firebase에 업로드
  const batch = writeBatch(db);
  totalOperations += places.length;
  
  try {
    for (const place of places) {
      const placeRef = doc(db, 'places', place.id);
      
      // GeoPoint 형식으로 위치 변환 (Firestore에서 위치 기반 쿼리를 위해)
      if (place.location && typeof place.location.latitude === 'number' && typeof place.location.longitude === 'number') {
        place.geoPoint = new GeoPoint(place.location.latitude, place.location.longitude);
      }
      
      batch.set(placeRef, place);
      console.log(`장소 데이터 배치에 추가: ${place.name}`);
      successfulOperations++;
    }

    // 배치 커밋
    await batch.commit();
    console.log(`장소 데이터 배치가 성공적으로 커밋되었습니다.`);
  } catch (error) {
    console.error('장소 데이터 생성 오류:', error);
    failedOperations += places.length - successfulOperations;
    successfulOperations = 0; // 배치가 실패하면 모든 작업이 실패한 것으로 간주
    throw error;
  }
}

// 테스트 사용자 생성 함수
async function createTestUsers() {
  console.log('테스트 사용자 데이터를 생성합니다...');
  
  const users = [
    {
      userId: "user1",
      name: "김민준",
      mbti: "ENFP",
      interests: ["커피", "음식", "여행", "사진"],
      customInterests: ["도시탐험", "인디음악"],
      talents: ["사진촬영", "글쓰기"],
      preferredCategories: ["cafe", "restaurant", "culture"],
      preferredLocations: [
        {
          name: "서울 강남",
          coordinates: {
            latitude: 37.5642135,
            longitude: 127.0016985
          },
          region: "서울",
          subRegion: "강남/서초"
        },
        {
          name: "서울 홍대",
          coordinates: {
            latitude: 37.556336,
            longitude: 126.922908
          },
          region: "서울",
          subRegion: "홍대/합정"
        }
      ],
      currentMood: {
        mood: "기쁨",
        intensity: 4,
        timestamp: serverTimestamp()
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    // ... 기타 사용자 데이터 (이전과 동일)
  ];

  totalOperations += users.length;
  
  try {
    for (const user of users) {
      const userRef = doc(db, 'users', user.userId);
      await setDoc(userRef, user);
      console.log(`사용자 데이터 업로드 완료: ${user.name}`);
      successfulOperations++;
    }
  
    console.log(`총 ${users.length}명의 테스트 사용자가 성공적으로 생성되었습니다.`);
  } catch (error) {
    console.error('사용자 데이터 생성 오류:', error);
    failedOperations += users.length - successfulOperations;
    throw error;
  }
}

// 테스트 리뷰 생성 함수
async function createTestReviews() {
  console.log('테스트 리뷰 데이터를 생성합니다...');
  
  const reviews = [
    {
      placeId: "gangnam-coffee-1",
      userId: "user1",
      userName: "김민준",
      userMbti: "ENFP",
      rating: 5,
      content: "정말 맛있는 커피와 깔끔한 인테리어가 인상적인 카페였습니다. ENFP인 저에게 딱 맞는 활기찬 분위기였어요!",
      photos: ["https://via.placeholder.com/800x600?text=Review+Photo+1"],
      visitDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      likeCount: 5,
      tags: ["분위기좋음", "커피맛집", "작업하기좋은"]
    },
    // ... 기타 리뷰 데이터 (이전과 동일)
  ];

  totalOperations += reviews.length;
  
  try {
    for (const review of reviews) {
      const reviewsCollection = collection(db, 'reviews');
      await addDoc(reviewsCollection, review);
      console.log(`리뷰 데이터 업로드 완료: ${review.userName}의 리뷰`);
      successfulOperations++;
    }
  
    console.log(`총 ${reviews.length}개의 테스트 리뷰가 성공적으로 생성되었습니다.`);
  } catch (error) {
    console.error('리뷰 데이터 생성 오류:', error);
    failedOperations += reviews.length - successfulOperations;
    throw error;
  }
}

// 테스트 저장된 장소 생성 함수 (추가)
async function createTestSavedPlaces() {
  console.log('테스트 저장된 장소 데이터를 생성합니다...');
  
  const savedPlaces = [
    {
      userId: "user1",
      placeId: "gangnam-coffee-1",
      savedAt: serverTimestamp()
    },
    {
      userId: "user2",
      placeId: "hongdae-coffee-1", 
      savedAt: serverTimestamp()
    },
    {
      userId: "user1",
      placeId: "hongdae-bookstore-1",
      savedAt: serverTimestamp()
    }
  ];

  totalOperations += savedPlaces.length;
  
  try {
    for (const savedPlace of savedPlaces) {
      // 복합 ID 생성 (userId_placeId 형식)
      const savedId = `${savedPlace.userId}_${savedPlace.placeId}`;
      const savedRef = doc(db, 'savedPlaces', savedId);
      
      await setDoc(savedRef, savedPlace);
      console.log(`저장된 장소 데이터 업로드 완료: ${savedPlace.userId}의 ${savedPlace.placeId}`);
      successfulOperations++;
    }
  
    console.log(`총 ${savedPlaces.length}개의 테스트 저장된 장소가 성공적으로 생성되었습니다.`);
  } catch (error) {
    console.error('저장된 장소 데이터 생성 오류:', error);
    failedOperations += savedPlaces.length - successfulOperations;
    throw error;
  }
}

// 테스트 방문 계획 및 기록 생성 함수 (추가)
async function createTestVisits() {
  console.log('테스트 방문 계획 및 기록 데이터를 생성합니다...');
  
  // 방문 계획 데이터
  const plannedVisits = [
    {
      userId: "user1",
      placeId: "hongdae-coffee-1",
      status: "planned",
      visitDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
      note: "친구와 함께 방문 예정",
      place: {
        id: "hongdae-coffee-1",
        placeId: "hongdae-coffee-1",
        name: "아트 카페 홍대",
        photos: ["https://via.placeholder.com/800x600?text=Art+Cafe+Space"],
        category: "art_cafe",
        subCategory: ""
      },
      createdAt: serverTimestamp()
    },
    {
      userId: "user2",
      placeId: "gangnam-gallery-1",
      status: "planned",
      visitDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
      note: "전시회 관람",
      place: {
        id: "gangnam-gallery-1",
        placeId: "gangnam-gallery-1",
        name: "모던 갤러리 강남",
        photos: ["https://via.placeholder.com/800x600?text=Modern+Gallery"],
        category: "culture",
        subCategory: ""
      },
      createdAt: serverTimestamp()
    }
  ];
  
  // 방문 기록 데이터
  const visitHistory = [
    {
      userId: "user1",
      placeId: "gangnam-coffee-1",
      status: "completed",
      visitDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5일 전
      visitedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      rating: 5,
      review: "정말 좋은 카페였습니다. 커피도 맛있고 분위기도 좋았어요!",
      place: {
        id: "gangnam-coffee-1",
        placeId: "gangnam-coffee-1",
        name: "스타일리쉬 커피 강남점",
        photos: ["https://via.placeholder.com/800x600?text=Cafe+Interior"],
        category: "cafe",
        subCategory: ""
      },
      createdAt: serverTimestamp()
    },
    {
      userId: "user2",
      placeId: "itaewon-rooftop-1",
      status: "completed",
      visitDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10일 전
      visitedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      rating: 4,
      review: "야경이 정말 멋있었습니다. 다음에도 방문하고 싶어요.",
      place: {
        id: "itaewon-rooftop-1",
        placeId: "itaewon-rooftop-1",
        name: "스카이 루프탑 바",
        photos: ["https://via.placeholder.com/800x600?text=Rooftop+Bar"],
        category: "bar",
        subCategory: ""
      },
      createdAt: serverTimestamp()
    }
  ];

  const allVisits = [...plannedVisits, ...visitHistory];
  totalOperations += allVisits.length;
  
  try {
    for (const visit of allVisits) {
      const visitsCollection = collection(db, 'visits');
      const docRef = await addDoc(visitsCollection, visit);
console.log(`방문 데이터 업로드 완료: ${visit.userId}의 ${visit.placeId} (ID: ${docRef.id})`);
      successfulOperations++;
    }
  
    console.log(`총 ${allVisits.length}개의 테스트 방문 데이터가 성공적으로 생성되었습니다.`);
  } catch (error) {
    console.error('방문 데이터 생성 오류:', error);
    failedOperations += allVisits.length - successfulOperations;
    throw error;
  }
}

// 스크립트 실행
seedDatabase().then(() => {
  console.log('스크립트 실행 완료');
  process.exit(0); // 성공적으로 완료 시 프로세스 종료
}).catch(error => {
  console.error('스크립트 실행 중 오류 발생:', error);
  process.exit(1); // 오류 발생 시 프로세스 종료
});
