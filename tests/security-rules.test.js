const firebase = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

// 테스트용 프로젝트 ID
const PROJECT_ID = 'mytripstyle-test';

// 테스트 사용자 ID
const ADMIN_USER_ID = 'admin-user';
const REGULAR_USER_ID = 'test-user';
const ANOTHER_USER_ID = 'another-user';

// Firestore 규칙 및 Storage 규칙 경로
const firestoreRulesPath = path.resolve(__dirname, '../firestore.rules');
const storageRulesPath = path.resolve(__dirname, '../storage.rules');

// Firestore 규칙 로드
const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf8');

// Storage 규칙 로드
const storageRules = fs.readFileSync(storageRulesPath, 'utf8');

// 테스트 전 설정 및 테스트 후 정리 함수
async function setupFirestoreTest() {
    // 이전 데이터 정리
    await firebase.clearFirestoreData({ projectId: PROJECT_ID });
    
    // 규칙 로딩
    await firebase.loadFirestoreRules({
      projectId: PROJECT_ID,
      rules: firestoreRules,
    });
    
    // 테스트용 Firestore 앱 인스턴스
    const adminApp = firebase.initializeAdminApp({ projectId: PROJECT_ID });
    const adminDb = adminApp.firestore();
    
    // 관리자 사용자 설정
    await adminDb.collection('admins').doc(ADMIN_USER_ID).set({ isAdmin: true });
    
    // 테스트 데이터 초기화
    return {
      adminDb,
      authenticatedDb: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: { uid: REGULAR_USER_ID },
      }).firestore(),
      anotherUserDb: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: { uid: ANOTHER_USER_ID },
      }).firestore(),
      adminUserDb: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: { uid: ADMIN_USER_ID },
      }).firestore(),
      unauthenticatedDb: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: null,
      }).firestore(),
    };
  }
  
  async function setupStorageTest() {
    // 규칙 로딩
    await firebase.loadStorageRules({
      projectId: PROJECT_ID,
      rules: storageRules,
    });
    
    // 테스트용 Storage 앱 인스턴스
    const adminStorage = firebase.initializeAdminApp({ projectId: PROJECT_ID }).storage();
    
    // 테스트 데이터 초기화
    return {
      adminStorage,
      authenticatedStorage: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: { uid: REGULAR_USER_ID },
      }).storage(),
      anotherUserStorage: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: { uid: ANOTHER_USER_ID },
      }).storage(),
      adminUserStorage: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: { uid: ADMIN_USER_ID },
      }).storage(),
      unauthenticatedStorage: firebase.initializeTestApp({
        projectId: PROJECT_ID,
        auth: null,
      }).storage(),
    };
  }
  
  // 테스트 후 정리
  async function cleanupTests() {
    await firebase.clearFirestoreData({ projectId: PROJECT_ID });
    await Promise.all(firebase.apps().map(app => app.delete()));
  }

  describe('MyTripStyle Firestore Security Rules', () => {
    let testEnv;
    
    beforeAll(async () => {
      testEnv = await setupFirestoreTest();
    });
    
    afterAll(async () => {
      await cleanupTests();
    });
    
    describe('User profiles', () => {
      beforeEach(async () => {
        // 테스트 사용자 프로필 생성
        await testEnv.adminDb.collection('users').doc(REGULAR_USER_ID).set({
          mbti: 'ENFP',
          interests: ['여행', '음식', '카페'],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        
        await testEnv.adminDb.collection('users').doc(ANOTHER_USER_ID).set({
          mbti: 'INTJ',
          interests: ['독서', '음악', '영화'],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
      
      test('인증된 사용자는 자신의 프로필을 읽을 수 있음', async () => {
        await firebase.assertSucceeds(
          testEnv.authenticatedDb.collection('users').doc(REGULAR_USER_ID).get()
        );
      });
      
      test('인증된 사용자는 다른 사용자의 프로필을 읽을 수 없음', async () => {
        await firebase.assertFails(
          testEnv.authenticatedDb.collection('users').doc(ANOTHER_USER_ID).get()
        );
      });
      
      test('인증된 사용자는 자신의 프로필을 수정할 수 있음', async () => {
        await firebase.assertSucceeds(
          testEnv.authenticatedDb.collection('users').doc(REGULAR_USER_ID).update({
            mbti: 'ENFJ',
            interests: ['여행', '음식', '사진']
          })
        );
      });
      
      test('인증된 사용자는 다른 사용자의 프로필을 수정할 수 없음', async () => {
        await firebase.assertFails(
          testEnv.authenticatedDb.collection('users').doc(ANOTHER_USER_ID).update({
            mbti: 'INFP'
          })
        );
      });
      
      test('비인증 사용자는 프로필에 접근할 수 없음', async () => {
        await firebase.assertFails(
          testEnv.unauthenticatedDb.collection('users').doc(REGULAR_USER_ID).get()
        );
      });
      
      test('관리자는 모든 사용자 프로필을 읽을 수 있음', async () => {
        await firebase.assertSucceeds(
          testEnv.adminUserDb.collection('users').doc(REGULAR_USER_ID).get()
        );
        
        await firebase.assertSucceeds(
          testEnv.adminUserDb.collection('users').doc(ANOTHER_USER_ID).get()
        );
      });
      
      test('유효하지 않은 MBTI 값은 거부됨', async () => {
        await firebase.assertFails(
          testEnv.authenticatedDb.collection('users').doc(REGULAR_USER_ID).update({
            mbti: 'INVALID'
          })
        );
      });
      
      test('interests 배열의 크기가 너무 크면 거부됨', async () => {
        const tooManyInterests = Array(30).fill().map((_, i) => `관심사${i}`);
        
        await firebase.assertFails(
          testEnv.authenticatedDb.collection('users').doc(REGULAR_USER_ID).update({
            interests: tooManyInterests
          })
        );
      });
    });
    
    describe('Places and reviews', () => {
        beforeEach(async () => {
          // 테스트 장소 데이터 생성
          await testEnv.adminDb.collection('places').doc('place1').set({
            name: '테스트 카페',
            location: { latitude: 37.5, longitude: 127.0 },
            category: 'cafe',
            mbtiMatchScore: {
              'ENFP': 8,
              'INTJ': 6
            }
          });
          
          // 테스트 리뷰 데이터 생성
          await testEnv.adminDb.collection('places').doc('place1').collection('reviews').doc('review1').set({
            userId: REGULAR_USER_ID,
            rating: 4,
            content: '좋은 카페입니다',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          await testEnv.adminDb.collection('places').doc('place1').collection('reviews').doc('review2').set({
            userId: ANOTHER_USER_ID,
            rating: 3,
            content: '괜찮은 카페입니다',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        
        test('인증된 사용자는 장소 데이터를 읽을 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('places').doc('place1').get()
          );
        });
        
        test('비인증 사용자는 장소 데이터를 읽을 수 없음', async () => {
          await firebase.assertFails(
            testEnv.unauthenticatedDb.collection('places').doc('place1').get()
          );
        });
        
        test('일반 사용자는 장소 데이터를 생성할 수 없음', async () => {
          await firebase.assertFails(
            testEnv.authenticatedDb.collection('places').doc('new-place').set({
              name: '새 장소',
              location: { latitude: 37.6, longitude: 127.1 },
              category: 'restaurant'
            })
          );
        });
        
        test('관리자는 장소 데이터를 생성할 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.adminUserDb.collection('places').doc('new-place').set({
              name: '새 장소',
              location: { latitude: 37.6, longitude: 127.1 },
              category: 'restaurant',
              mbtiMatchScore: {
                'ENFP': 7,
                'INTJ': 8
              }
            })
          );
        });
        
        test('인증된 사용자는 리뷰를 읽을 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('places').doc('place1').collection('reviews').get()
          );
        });
        
        test('인증된 사용자는 리뷰를 작성할 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('places').doc('place1').collection('reviews').doc('my-review').set({
              userId: REGULAR_USER_ID,
              rating: 5,
              content: '훌륭한 장소입니다',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            })
          );
        });
        
        test('사용자는 타인의 userId로 리뷰를 작성할 수 없음', async () => {
          await firebase.assertFails(
            testEnv.authenticatedDb.collection('places').doc('place1').collection('reviews').doc('fake-review').set({
              userId: ANOTHER_USER_ID,
              rating: 5,
              content: '훌륭한 장소입니다',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            })
          );
        });
        
        test('사용자는 자신의 리뷰만 수정할 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('places').doc('place1').collection('reviews').doc('review1').update({
              content: '수정된 리뷰 내용',
              rating: 5
            })
          );
          
          await firebase.assertFails(
            testEnv.authenticatedDb.collection('places').doc('place1').collection('reviews').doc('review2').update({
              content: '다른 사용자의 리뷰를 수정 시도'
            })
          );
        });
        
        test('유효하지 않은 별점은 거부됨', async () => {
          await firebase.assertFails(
            testEnv.authenticatedDb.collection('places').doc('place1').collection('reviews').doc('invalid-review').set({
              userId: REGULAR_USER_ID,
              rating: 6, // 1-5 범위를 벗어남
              content: '잘못된 평점',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            })
          );
        });
      });

      describe('Saved places', () => {
        beforeEach(async () => {
          // 저장된 장소 테스트 데이터 생성
          await testEnv.adminDb.collection('users').doc(REGULAR_USER_ID).collection('savedPlaces').doc('place1').set({
            placeId: 'place1',
            savedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        
        test('사용자는 자신의 저장된 장소를 읽을 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('users').doc(REGULAR_USER_ID).collection('savedPlaces').get()
          );
        });
        
        test('사용자는 다른 사용자의 저장된 장소를 읽을 수 없음', async () => {
          await firebase.assertFails(
            testEnv.authenticatedDb.collection('users').doc(ANOTHER_USER_ID).collection('savedPlaces').get()
          );
        });
        
        test('사용자는 장소를 저장할 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('users').doc(REGULAR_USER_ID).collection('savedPlaces').doc('place2').set({
              placeId: 'place2',
              savedAt: firebase.firestore.FieldValue.serverTimestamp()
            })
          );
        });
        
        test('사용자는 저장된 장소를 삭제할 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('users').doc(REGULAR_USER_ID).collection('savedPlaces').doc('place1').delete()
          );
        });
      });
      
      describe('API usage and app config', () => {
        beforeEach(async () => {
          // API 사용량 및 앱 설정 테스트 데이터 생성
          await testEnv.adminDb.collection('apiUsage').doc('usage1').set({
            userId: REGULAR_USER_ID,
            function: 'getRecommendations',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          await testEnv.adminDb.collection('appConfig').doc('features').set({
            enableWeather: true,
            enableMultiAgent: false
          });
        });
        
        test('일반 사용자는 API 사용량 로그를 생성할 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('apiUsage').add({
              userId: REGULAR_USER_ID,
              function: 'nearbyPlaces',
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
          );
        });
        
        test('일반 사용자는 API 사용량 로그를 읽을 수 없음', async () => {
          await firebase.assertFails(
            testEnv.authenticatedDb.collection('apiUsage').get()
          );
        });
        
        test('관리자는 API 사용량 로그를 읽을 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.adminUserDb.collection('apiUsage').get()
          );
        });
        
        test('인증된 사용자는 앱 설정을 읽을 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.authenticatedDb.collection('appConfig').doc('features').get()
          );
        });
        
        test('일반 사용자는 앱 설정을 수정할 수 없음', async () => {
          await firebase.assertFails(
            testEnv.authenticatedDb.collection('appConfig').doc('features').update({
              enableWeather: false
            })
          );
        });
        
        test('관리자는 앱 설정을 수정할 수 있음', async () => {
          await firebase.assertSucceeds(
            testEnv.adminUserDb.collection('appConfig').doc('features').update({
              enableWeather: false,
              enableMultiAgent: true
            })
          );
        });
      });
    });

    describe('MyTripStyle Storage Security Rules', () => {
        let storageEnv;
        
        beforeAll(async () => {
          storageEnv = await setupStorageTest();
        });
        
        afterAll(async () => {
          await cleanupTests();
        });
        
        describe('Profile images', () => {
          const userProfilePath = 'users/test-user/profile.jpg';
          const anotherUserProfilePath = 'users/another-user/profile.jpg';
          const testFile = Buffer.from('테스트 이미지 데이터', 'utf8');
          
          test('사용자는 자신의 프로필 이미지를 업로드할 수 있음', async () => {
            await firebase.assertSucceeds(
              storageEnv.authenticatedStorage.ref(userProfilePath).put(testFile)
            );
          });
          
          test('사용자는 다른 사용자의 프로필 이미지를 업로드할 수 없음', async () => {
            await firebase.assertFails(
              storageEnv.authenticatedStorage.ref(anotherUserProfilePath).put(testFile)
            );
          });
          
          test('인증된 사용자는 프로필 이미지를 읽을 수 있음', async () => {
            // 먼저 이미지 업로드
            await storageEnv.adminStorage.ref(userProfilePath).put(testFile);
            
            await firebase.assertSucceeds(
              storageEnv.authenticatedStorage.ref(userProfilePath).getDownloadURL()
            );
          });
          
          test('비인증 사용자는 프로필 이미지에 접근할 수 없음', async () => {
            await firebase.assertFails(
              storageEnv.unauthenticatedStorage.ref(userProfilePath).getDownloadURL()
            );
          });
        });
        
        describe('Place images', () => {
          const placePath = 'places/place1/image1.jpg';
          const testFile = Buffer.from('테스트 장소 이미지 데이터', 'utf8');
          
          test('일반 사용자는 장소 이미지를 업로드할 수 없음', async () => {
            await firebase.assertFails(
              storageEnv.authenticatedStorage.ref(placePath).put(testFile)
            );
          });
          
          test('관리자는 장소 이미지를 업로드할 수 있음', async () => {
            await firebase.assertSucceeds(
              storageEnv.adminUserStorage.ref(placePath).put(testFile)
            );
          });
          
          test('인증된 사용자는 장소 이미지를 읽을 수 있음', async () => {
            // 먼저 이미지 업로드
            await storageEnv.adminStorage.ref(placePath).put(testFile);
            
            await firebase.assertSucceeds(
              storageEnv.authenticatedStorage.ref(placePath).getDownloadURL()
            );
          });
          
          test('비인증 사용자는 장소 이미지에 접근할 수 없음', async () => {
            await firebase.assertFails(
              storageEnv.unauthenticatedStorage.ref(placePath).getDownloadURL()
            );
          });
        });
        
        describe('Review images', () => {
          const reviewImagePath = 'reviews/review1/image1.jpg';
          const testFile = Buffer.from('테스트 리뷰 이미지 데이터', 'utf8');
          
          beforeEach(async () => {
            // Firestore에 리뷰 데이터 설정 (Storage 규칙이 이 데이터를 참조)
            const adminDb = firebase.initializeAdminApp({ projectId: PROJECT_ID }).firestore();
            await adminDb.collection('places').doc('place1').collection('reviews').doc('review1').set({
              userId: REGULAR_USER_ID,
              content: '테스트 리뷰',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          
          test('인증된 사용자는 리뷰 이미지를 업로드할 수 있음', async () => {
            await firebase.assertSucceeds(
              storageEnv.authenticatedStorage.ref(reviewImagePath).put(testFile)
            );
          });
          
          test('인증된 사용자는 리뷰 이미지를 읽을 수 있음', async () => {
            // 먼저 이미지 업로드
            await storageEnv.adminStorage.ref(reviewImagePath).put(testFile);
            
            await firebase.assertSucceeds(
              storageEnv.authenticatedStorage.ref(reviewImagePath).getDownloadURL()
            );
          });
        });
        
        describe('Public files', () => {
          const publicFilePath = 'public/app-logo.png';
          const testFile = Buffer.from('공개 이미지 데이터', 'utf8');
          
          beforeEach(async () => {
            // 테스트 파일 업로드
            await storageEnv.adminStorage.ref(publicFilePath).put(testFile);
          });
          
          test('누구나 공개 파일을 읽을 수 있음', async () => {
            await firebase.assertSucceeds(
              storageEnv.unauthenticatedStorage.ref(publicFilePath).getDownloadURL()
            );
          });
          
          test('일반 사용자는 공개 파일을 쓸 수 없음', async () => {
            await firebase.assertFails(
              storageEnv.authenticatedStorage.ref(publicFilePath).put(testFile)
            );
          });
          
          test('관리자는 공개 파일을 쓸 수 있음', async () => {
            await firebase.assertSucceeds(
              storageEnv.adminUserStorage.ref(publicFilePath).put(testFile)
            );
          });
        });
      });

    // npm test 명령어로 이 파일을 실행할 수 있게 export
    module.exports = {
        setupFirestoreTest,
        setupStorageTest,
        cleanupTests
    };  
