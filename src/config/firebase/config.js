/**
 * Firebase 설정 및 초기화
 * 
 * 이 모듈은 MyTripStyle 애플리케이션의 Firebase 서비스 초기화 및 연결 관리를 담당합니다.
 * 환경 변수를 사용해 개발/테스트/프로덕션 환경에 따라 다른 Firebase 프로젝트에 연결합니다.
 */

// Firebase SDK 임포트
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';

// 환경 변수 유틸리티 임포트
import { Env } from '../utils/envValidator';

// Firebase 설정
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firebase 서비스 인스턴스
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Analytics 초기화 (브라우저 지원 시)
let analytics = null;
isSupported().then(supported => {
  if (supported && Env.features.enableAnalytics) {
    analytics = getAnalytics(app);
    console.log('Firebase Analytics initialized');
  }
});

// 에뮬레이터 사용 설정 (개발 환경)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATOR === 'true') {
  // Firebase 로컬 에뮬레이터 포트 설정
  const EMULATOR_HOST = 'localhost';
  const AUTH_EMULATOR_PORT = 9099;
  const FIRESTORE_EMULATOR_PORT = 8080;
  const FUNCTIONS_EMULATOR_PORT = 5001;
  const STORAGE_EMULATOR_PORT = 9199;
  
  try {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`);
    connectFirestoreEmulator(firestore, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    connectFunctionsEmulator(functions, EMULATOR_HOST, FUNCTIONS_EMULATOR_PORT);
    connectStorageEmulator(storage, EMULATOR_HOST, STORAGE_EMULATOR_PORT);
    
    console.log('Firebase Emulators connected');
  } catch (error) {
    console.error('Failed to connect to Firebase Emulators:', error);
  }
}

/**
 * 앱 환경 확인
 * @returns {string} 현재 환경 ('development', 'test', 'production')
 */
export function getEnvironment() {
    return process.env.NODE_ENV || 'development';
  }
  
  /**
   * 현재 Firebase 프로젝트 ID 반환
   * @returns {string} Firebase 프로젝트 ID
   */
  export function getProjectId() {
    return firebaseConfig.projectId;
  }
  
  /**
   * 기능 활성화 여부 확인
   * @param {string} featureName 기능명
   * @returns {boolean} 기능 활성화 여부
   */
  export function isFeatureEnabled(featureName) {
    const featureFlags = {
      analytics: Env.features.enableAnalytics,
      weather: Env.features.enableWeather,
      multiAgent: Env.features.enableMultiAgent,
      debug: Env.features.enableDebug,
      mockData: Env.features.enableMockData
    };
    
    return featureFlags[featureName] || false;
  }
  
  /**
   * Firebase 분석 이벤트 로깅 (활성화된 경우)
   * @param {string} eventName 이벤트명
   * @param {Object} eventParams 이벤트 매개변수
   */
  export function logEvent(eventName, eventParams = {}) {
    if (analytics) {
      import('firebase/analytics').then(({ logEvent }) => {
        logEvent(analytics, eventName, eventParams);
      });
    }
  }

  /**
 * Firestore 문서 가져오기 (오류 처리 포함)
 * @param {string} collection 컬렉션 이름
 * @param {string} docId 문서 ID
 * @returns {Promise<Object>} 문서 데이터
 */
export async function getDocument(collection, docId) {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const docRef = doc(firestore, collection, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error getting document ${collection}/${docId}:`, error);
      throw error;
    }
  }
  
  /**
   * Firestore 문서 저장 (오류 처리 포함)
   * @param {string} collection 컬렉션 이름
   * @param {string} docId 문서 ID (선택적)
   * @param {Object} data 저장할 데이터
   * @returns {Promise<string>} 문서 ID
   */
  export async function saveDocument(collection, docId, data) {
    try {
      const { doc, setDoc, collection: firestoreCollection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      // 타임스탬프 필드 추가
      const docData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      // docId가 없으면 자동 생성
      if (docId) {
        const docRef = doc(firestore, collection, docId);
        await setDoc(docRef, docData, { merge: true });
        return docId;
      } else {
        const collectionRef = firestoreCollection(firestore, collection);
        const newDocRef = await addDoc(collectionRef, {
          ...docData,
          createdAt: serverTimestamp()
        });
        return newDocRef.id;
      }
    } catch (error) {
      console.error(`Error saving document to ${collection}:`, error);
      throw error;
    }
  }
  
  /**
   * Firestore 쿼리 실행 (오류 처리 포함)
   * @param {string} collectionName 컬렉션 이름
   * @param {Array} queryConstraints 쿼리 제약 조건 배열
   * @returns {Promise<Array>} 문서 배열
   */
  export async function queryDocuments(collectionName, queryConstraints = []) {
    try {
      const { collection, query, getDocs } = await import('firebase/firestore');
      const collectionRef = collection(firestore, collectionName);
      const q = query(collectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error querying collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
 * 현재 인증된 사용자 가져오기
 * @returns {Object|null} 현재 사용자 또는 null
 */
export function getCurrentUser() {
    return auth.currentUser;
  }
  
  /**
   * 사용자 인증 상태 변경 리스너 등록
   * @param {Function} callback 콜백 함수
   * @returns {Function} 구독 해제 함수
   */
  export function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  }
  
  /**
   * 이메일/비밀번호로 로그인
   * @param {string} email 이메일
   * @param {string} password 비밀번호
   * @returns {Promise<Object>} 사용자 인증 정보
   */
  export async function signInWithEmail(email, password) {
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  
  /**
   * 이메일/비밀번호로 회원가입
   * @param {string} email 이메일
   * @param {string} password 비밀번호
   * @returns {Promise<Object>} 사용자 인증 정보
   */
  export async function signUpWithEmail(email, password) {
    try {
      const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 이메일 인증 발송
      await sendEmailVerification(userCredential.user);
      
      return userCredential.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }
  
  /**
   * 로그아웃
   * @returns {Promise<void>}
   */
  export async function signOut() {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  /**
 * Storage에 파일 업로드
 * @param {string} path 저장 경로
 * @param {File} file 업로드할 파일
 * @returns {Promise<string>} 다운로드 URL
 */
export async function uploadFile(path, file) {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error(`Error uploading file to ${path}:`, error);
      throw error;
    }
  }
  
  /**
   * Cloud Function 호출
   * @param {string} functionName 함수 이름
   * @param {Object} data 함수 매개변수
   * @returns {Promise<any>} 함수 응답
   */
  export async function callFunction(functionName, data = {}) {
    try {
      const { httpsCallable } = await import('firebase/functions');
      const func = httpsCallable(functions, functionName);
      const result = await func(data);
      return result.data;
    } catch (error) {
      console.error(`Error calling function ${functionName}:`, error);
      throw error;
    }
  }

  // 서비스 인스턴스 내보내기
export { app, auth, firestore, storage, functions, analytics };

// 기본 내보내기
export default {
  app,
  auth,
  firestore,
  storage,
  functions,
  analytics,
  getEnvironment,
  getProjectId,
  isFeatureEnabled,
  logEvent,
  getCurrentUser,
  onAuthStateChanged,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getDocument,
  saveDocument,
  queryDocuments,
  uploadFile,
  callFunction
};
