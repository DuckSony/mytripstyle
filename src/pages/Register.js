// src/pages/Register.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
 Container,
 Box,
 Paper,
 Typography,
 TextField,
 Button,
 Grid,
 Link,
 Divider,
 InputAdornment,
 IconButton,
 Alert,
 CircularProgress,
 FormControl,
 InputLabel,
 Select,
 MenuItem,
 Chip,
 OutlinedInput,
 FormHelperText,
 Stepper,
 Step,
 StepLabel
} from '@mui/material';
import {
 Google as GoogleIcon,
 Visibility as VisibilityIcon,
 VisibilityOff as VisibilityOffIcon,
 ChevronRight as ChevronRightIcon,
 ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';

// MBTI 유형 목록
const mbtiTypes = [
 'INTJ', 'INTP', 'ENTJ', 'ENTP',
 'INFJ', 'INFP', 'ENFJ', 'ENFP',
 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
 'ISTP', 'ISFP', 'ESTP', 'ESFP'
];

// 관심사 목록
const interestOptions = [
 '여행', '음식', '카페', '예술', '음악',
 '스포츠', '자연', '사진', '영화', '독서',
 '쇼핑', '전시', '액티비티', '힐링'
];

// 재능 목록
const talentOptions = [
 '사진촬영', '글쓰기', '운동', '요리', '음악연주',
 '그림그리기', '춤', '언어', '수영', '등산',
 '요가', '명상', '수공예', '운전'
];

// 관심 지역 목록 (한국 기준)
const regionOptions = [
 // 서울
 { value: 'seoul', label: '서울 전체' },
 { value: 'seoul_gangnam', label: '서울 - 강남/서초' },
 { value: 'seoul_gangbuk', label: '서울 - 강북/성북' },
 { value: 'seoul_mapo', label: '서울 - 마포/홍대/연남' },
 { value: 'seoul_yeongdeungpo', label: '서울 - 영등포/여의도' },
 { value: 'seoul_jongno', label: '서울 - 종로/인사동' },
 { value: 'seoul_gangdong', label: '서울 - 강동/송파' },
 
 // 경기도
 { value: 'gyeonggi', label: '경기도 전체' },
 { value: 'gyeonggi_suwon', label: '경기 - 수원' },
 { value: 'gyeonggi_yongin', label: '경기 - 용인' },
 { value: 'gyeonggi_seongnam', label: '경기 - 성남' },
 { value: 'gyeonggi_goyang', label: '경기 - 고양/파주' },
 { value: 'gyeonggi_bucheon', label: '경기 - 부천/김포' },
 { value: 'gyeonggi_anyang', label: '경기 - 안양/군포/의왕' },
 { value: 'gyeonggi_ansan', label: '경기 - 안산/시흥' },
 
 // 인천
 { value: 'incheon', label: '인천 전체' },
 { value: 'incheon_jung', label: '인천 - 중구/동구' },
 { value: 'incheon_yeonsu', label: '인천 - 연수구/송도' },
 
 // 기타 지역
 { value: 'gangwon', label: '강원도' },
 { value: 'chungcheong_north', label: '충청북도' },
 { value: 'chungcheong_south', label: '충청남도' },
 { value: 'jeolla_north', label: '전라북도' },
 { value: 'jeolla_south', label: '전라남도' },
 { value: 'gyeongsang_north', label: '경상북도' },
 { value: 'gyeongsang_south', label: '경상남도' },
 { value: 'jeju', label: '제주도' },
 
 // 광역시
 { value: 'busan', label: '부산' },
 { value: 'daegu', label: '대구' },
 { value: 'daejeon', label: '대전' },
 { value: 'gwangju', label: '광주' },
 { value: 'ulsan', label: '울산' },
 { value: 'sejong', label: '세종' }
];

// 회원가입 단계 정의
const steps = ['계정 정보', '프로필 정보', '관심사 & 재능'];

const Register = () => {
 const navigate = useNavigate();
 const location = useLocation();
 const { register, loginWithGoogle } = useAuth();
 
 // URL에서 단계 정보 추출 (단계 지속성 확보)
 const getStepFromUrl = () => {
   const searchParams = new URLSearchParams(location.search);
   const stepParam = searchParams.get('step');
   return stepParam ? parseInt(stepParam, 10) : 0;
 };
 
 // 현재 단계
 const [activeStep, setActiveStep] = useState(() => {
   try {
     // 로컬 스토리지 또는 URL에서 단계 복원 시도
     const savedStep = localStorage.getItem('registerActiveStep');
     if (savedStep !== null) {
       return parseInt(savedStep, 10);
     }
     return getStepFromUrl();
   } catch (error) {
     console.error("단계 복원 오류:", error);
     return 0;
   }
 });
 
 // 계정 정보
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 
 // 프로필 정보
 const [name, setName] = useState('');
 const [mbti, setMbti] = useState('');
 
 // 관심사 & 재능
 const [interests, setInterests] = useState([]);
 const [customInterests, setCustomInterests] = useState('');
 const [talents, setTalents] = useState([]);
 const [customTalents, setCustomTalents] = useState('');
 const [preferredRegions, setPreferredRegions] = useState([]);
 
 // 드롭다운 상태 관리
 const [talentsOpen, setTalentsOpen] = useState(false);
 const [regionsOpen, setRegionsOpen] = useState(false);
 
 // 상태
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);
 
 // 유효성 검사
 const [emailError, setEmailError] = useState('');
 const [passwordError, setPasswordError] = useState('');
 const [confirmPasswordError, setConfirmPasswordError] = useState('');

 // URL 매개변수 업데이트 함수
 const updateUrlParams = useCallback((step) => {
   const searchParams = new URLSearchParams(location.search);
   searchParams.set('step', step.toString());
   
   // URL 업데이트 (페이지 새로고침 없이)
   const newUrl = `${location.pathname}?${searchParams.toString()}`;
   window.history.replaceState(null, '', newUrl);
 }, [location.pathname, location.search]);

 // 단계 변경 감지 및 URL/로컬 스토리지 업데이트
 useEffect(() => {
   console.log("===== activeStep 변경 =====");
   console.log("현재 단계:", activeStep);
   
   try {
     // 로컬 스토리지에 현재 단계 저장
     localStorage.setItem('registerActiveStep', activeStep.toString());
     
     // URL 매개변수 업데이트
     updateUrlParams(activeStep);
   } catch (error) {
     console.error("단계 저장 오류:", error);
   }
 }, [activeStep, updateUrlParams]);

 // 상태 백업 (단계 간 데이터 유지)
 useEffect(() => {
   try {
     // 각 단계별 데이터 저장
     const allData = {
       step0: {
         email, 
         password, 
         confirmPassword
       },
       step1: {
         name, 
         mbti
       },
       step2: {
         interests,
         customInterests,
         talents,
         customTalents,
         preferredRegions
       },
       activeStep
     };
     
     // 모든 데이터를 하나의 객체로 저장 (단일 저장점)
     localStorage.setItem('registerData', JSON.stringify(allData));
     
   } catch (error) {
     console.error("상태 저장 오류:", error);
   }
 }, [activeStep, email, password, confirmPassword, name, mbti, 
     interests, customInterests, talents, customTalents, preferredRegions]);

 // 로컬스토리지에서 이전 데이터 복원
 useEffect(() => {
   try {
     const savedData = localStorage.getItem('registerData');
     if (savedData) {
       const parsedData = JSON.parse(savedData);
       
       // 계정 정보 복원
       if (parsedData.step0) {
         setEmail(parsedData.step0.email || '');
         setPassword(parsedData.step0.password || '');
         setConfirmPassword(parsedData.step0.confirmPassword || '');
       }
       
       // 프로필 정보 복원
       if (parsedData.step1) {
         setName(parsedData.step1.name || '');
         setMbti(parsedData.step1.mbti || '');
       }
       
       // 관심사 & 재능 정보 복원
       if (parsedData.step2) {
         setInterests(parsedData.step2.interests || []);
         setCustomInterests(parsedData.step2.customInterests || '');
         setTalents(parsedData.step2.talents || []);
         setCustomTalents(parsedData.step2.customTalents || '');
         setPreferredRegions(parsedData.step2.preferredRegions || []);
       }
       
       console.log("저장된 데이터 복원 완료");
     }
   } catch (error) {
     console.error("데이터 복원 오류:", error);
   }
 }, []);
 
 // 이메일 변경 핸들러
 const handleEmailChange = (e) => {
   setEmail(e.target.value);
   setEmailError('');
   setError('');
 };
 
 // 비밀번호 변경 핸들러
 const handlePasswordChange = (e) => {
   setPassword(e.target.value);
   setPasswordError('');
   setError('');
   
   if (confirmPassword && e.target.value !== confirmPassword) {
     setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
   } else {
     setConfirmPasswordError('');
   }
 };
 
 // 비밀번호 확인 변경 핸들러
 const handleConfirmPasswordChange = (e) => {
   setConfirmPassword(e.target.value);
   
   if (e.target.value !== password) {
     setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
   } else {
     setConfirmPasswordError('');
   }
 };
 
 // 비밀번호 표시 토글
 const handleTogglePasswordVisibility = () => {
   setShowPassword(!showPassword);
 };
 
 // 이름 변경 핸들러
 const handleNameChange = (e) => {
   setName(e.target.value);
 };
 
 // MBTI 변경 핸들러
 const handleMbtiChange = (e) => {
   setMbti(e.target.value);
 };
 
 // 관심사 변경 핸들러
 const handleInterestsChange = (event) => {
   const {
     target: { value },
   } = event;
   setInterests(typeof value === 'string' ? value.split(',') : value);
 };
 
 // 사용자 정의 관심사 변경 핸들러
 const handleCustomInterestsChange = (e) => {
   setCustomInterests(e.target.value);
 };
 
 // 재능 변경 핸들러
 const handleTalentsChange = (event) => {
   const {
     target: { value },
   } = event;
   setTalents(typeof value === 'string' ? value.split(',') : value);
 };
 
 // 사용자 정의 재능 변경 핸들러
 const handleCustomTalentsChange = (e) => {
   setCustomTalents(e.target.value);
 };
 
 // 관심 지역 변경 핸들러
 const handleRegionsChange = (event) => {
   const {
     target: { value },
   } = event;
   setPreferredRegions(typeof value === 'string' ? value.split(',') : value);
 };
 
 // 계정 정보 유효성 검사
 const validateStep1 = useCallback(() => {
   let isValid = true;
   
   // 이메일 유효성 검사
   if (!email) {
     setEmailError('이메일을 입력해주세요.');
     isValid = false;
   } else if (!/\S+@\S+\.\S+/.test(email)) {
     setEmailError('유효한 이메일 형식이 아닙니다.');
     isValid = false;
   }
   
   // 비밀번호 유효성 검사
   if (!password) {
     setPasswordError('비밀번호를 입력해주세요.');
     isValid = false;
   } else if (password.length < 6) {
     setPasswordError('비밀번호는 최소 6자 이상이어야 합니다.');
     isValid = false;
   }
   
   // 비밀번호 확인 유효성 검사
   if (!confirmPassword) {
     setConfirmPasswordError('비밀번호 확인을 입력해주세요.');
     isValid = false;
   } else if (password !== confirmPassword) {
     setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
     isValid = false;
   }
   
   return isValid;
 }, [email, password, confirmPassword]);
 
 // 다음 단계로 이동
 const handleNext = useCallback((e) => {
   if (isSubmitting) return;
   setIsSubmitting(true);
   
   console.log("다음 버튼 클릭됨!");
   
   if (e) {
     e.preventDefault();
     e.stopPropagation();
   }
   
   if (activeStep === 0) {
     if (!validateStep1()) {
       console.log("유효성 검사 실패");
       setIsSubmitting(false);
       return;
     }
     console.log("유효성 검사 통과");
   }
   
   setActiveStep(prevStep => {
     const nextStep = prevStep + 1;
     console.log(`단계 업데이트: ${prevStep} -> ${nextStep}`);
     localStorage.setItem('registerActiveStep', nextStep.toString());
     return nextStep;
   });
   
   setTimeout(() => {
     setIsSubmitting(false);
   }, 500);
 }, [activeStep, isSubmitting, validateStep1]);
 
 // 이전 단계로 이동
 const handleBack = useCallback(() => {
   if (isSubmitting) return;
   setIsSubmitting(true);
   
   setActiveStep(prevStep => {
     const nextStep = Math.max(0, prevStep - 1);
     localStorage.setItem('registerActiveStep', nextStep.toString());
     return nextStep;
   });
   
   setTimeout(() => {
     setIsSubmitting(false);
   }, 500);
 }, [isSubmitting]);
 
 // 회원가입 제출
 const handleSignUp = useCallback(async (e) => {
   if (e) {
     e.preventDefault();
     e.stopPropagation();
   }
   
   console.log("가입하기 버튼 클릭됨!");
   
   if (isSubmitting) {
     console.log("이미 제출 중입니다.");
     return;
   }
   
   setIsSubmitting(true);
   setLoading(true);
   setError('');
   
   try {
     // regionOptions에서 선택된 지역 정보 가져오기
     const locationObjects = preferredRegions.map(regionId => {
       const option = regionOptions.find(opt => opt.value === regionId);
       if (!option) return null;
       
       // 지역 정보 파싱 (서울 - 강남/서초 형식)
       let region, subRegion;
       
       if (option.label.includes(' - ')) {
         const parts = option.label.split(' - ');
         region = parts[0].replace('서울', '서울').replace('경기', '경기도').trim();
         subRegion = parts[1].trim();
       } else {
         region = option.label.trim();
         subRegion = null;
       }
       
       return { region, subRegion, id: regionId };
     }).filter(Boolean);

     // 사용자 데이터 준비
     const userData = {
       name,
       mbti,
       interests,
       customInterests: customInterests.split(',').map(item => item.trim()).filter(Boolean),
       talents,
       customTalents: customTalents.split(',').map(item => item.trim()).filter(Boolean),
       // 올바른 형식으로 저장
       preferredLocations: locationObjects
     };
     
     console.log("회원가입 시도:", { email, userData });
     
     // 직접 등록 함수 호출
     const result = await register(email, password, userData);
     console.log("회원가입 결과:", result);
     
     if (result.success) {
       console.log("회원가입 성공!");
       alert("회원가입이 완료되었습니다!");
       
       // 회원가입 완료 후 임시 데이터 삭제
       localStorage.removeItem('registerData');
       localStorage.removeItem('registerActiveStep');
       
       navigate('/'); // 홈으로 이동
     } else {
       console.error("회원가입 실패:", result.error);
       setError(result.error || '회원가입에 실패했습니다.');
     }
   } catch (err) {
     console.error('회원가입 오류:', err);
     setError('회원가입 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
   } finally {
     setLoading(false);
     setIsSubmitting(false);
   }
 }, [email, password, name, mbti, interests, customInterests, talents, 
     customTalents, preferredRegions, isSubmitting, navigate, register]);
 
 // Google 로그인
 const handleGoogleLogin = useCallback(async () => {
   if (isSubmitting) return;
   setIsSubmitting(true);
   
   try {
     setError('');
     setLoading(true);
     
     console.log("Google 로그인 시도");
     const result = await loginWithGoogle();
     console.log("Google 로그인 결과:", result);
     
     if (result.success) {
       // 임시 데이터 삭제
       localStorage.removeItem('registerData');
       localStorage.removeItem('registerActiveStep');
       
       navigate('/');
     } else {
       setError(result.error || 'Google 로그인에 실패했습니다.');
     }
   } catch (err) {
     console.error('Google 로그인 오류:', err);
     setError('Google 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
   } finally {
     setLoading(false);
     setIsSubmitting(false);
   }
 }, [loginWithGoogle, navigate, isSubmitting]);
 
 // 단계별 내용 렌더링
 const getStepContent = (step) => {
   switch (step) {
     case 0:
       // 계정 정보 단계
       return (
         <>
           <TextField
             label="이메일"
             type="email"
             value={email}
             onChange={handleEmailChange}
             fullWidth
             required
             margin="normal"
             variant="outlined"
             error={!!emailError}
             helperText={emailError}
             autoComplete="email"
           />
           
           <TextField
             label="비밀번호"
             type={showPassword ? 'text' : 'password'}
             value={password}
             onChange={handlePasswordChange}
             fullWidth
             required
             margin="normal"
             variant="outlined"
             error={!!passwordError}
             helperText={passwordError}
             InputProps={{
               endAdornment: (
                 <InputAdornment position="end">
                   <IconButton
                     aria-label="toggle password visibility"
                     onClick={handleTogglePasswordVisibility}
                     edge="end"
                   >
                     {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                   </IconButton>
                 </InputAdornment>
               )
             }}
           />
           
           <TextField
             label="비밀번호 확인"
             type={showPassword ? 'text' : 'password'}
             value={confirmPassword}
             onChange={handleConfirmPasswordChange}
             fullWidth
             required
             margin="normal"
             variant="outlined"
             error={!!confirmPasswordError}
             helperText={confirmPasswordError}
           />
         </>
       );
       
     case 1:
       // 프로필 정보 단계
       return (
         <>
           <TextField
             label="이름 (닉네임)"
             value={name}
             onChange={handleNameChange}
             fullWidth
             margin="normal"
             variant="outlined"
             helperText="다른 사용자에게 표시될 이름입니다."
           />
           
           <FormControl fullWidth margin="normal" variant="outlined">
             <InputLabel id="mbti-label">MBTI 유형 (선택)</InputLabel>
             <Select
               labelId="mbti-label"
               value={mbti}
               onChange={handleMbtiChange}
               label="MBTI 유형 (선택)"
             >
               <MenuItem value="">
                 <em>선택 안함</em>
               </MenuItem>
               {mbtiTypes.map((type) => (
                 <MenuItem key={type} value={type}>
                   {type}
                 </MenuItem>
               ))}
             </Select>
             <FormHelperText>
               MBTI 유형은 맞춤형 장소 추천을 위해 사용됩니다.
             </FormHelperText>
           </FormControl>
         </>
       );
       
     case 2:
       // 관심사 & 재능 단계
       return (
         <>
           <FormControl fullWidth margin="normal" variant="outlined">
             <InputLabel id="interests-label">관심사</InputLabel>
             <Select
               labelId="interests-label"
               multiple
               value={interests}
               onChange={handleInterestsChange}
               input={<OutlinedInput label="관심사" />}
               renderValue={(selected) => (
                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                   {selected.map((value) => (
                     <Chip key={value} label={value} />
                   ))}
                 </Box>
               )}
               MenuProps={{
                 PaperProps: {
                   style: {
                     maxHeight: 224,
                     width: 250,
                   },
                 },
               }}
             >
               {interestOptions.map((option) => (
                 <MenuItem key={option} value={option}>
                   {option}
                 </MenuItem>
               ))}
             </Select>
             <FormHelperText>
               관심사는 맞춤형 장소 추천에 사용됩니다.
             </FormHelperText>
           </FormControl>
           
           <TextField
             label="추가 관심사 (쉼표로 구분)"
             value={customInterests}
             onChange={handleCustomInterestsChange}
             fullWidth
             margin="normal"
             variant="outlined"
             helperText="목록에 없는 관심사가 있다면 쉼표(,)로 구분하여 입력해주세요."
           />
           
           <FormControl fullWidth margin="normal" variant="outlined">
             <InputLabel id="talents-label">재능</InputLabel>
             <Select
               labelId="talents-label"
               multiple
               value={talents}
               onChange={handleTalentsChange}
               input={<OutlinedInput label="재능" />}
               renderValue={(selected) => (
                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                   {selected.map((value) => (
                     <Chip key={value} label={value} />
                   ))}
                 </Box>
               )}
               MenuProps={{
                 PaperProps: {
                   style: {
                     maxHeight: 224,
                     width: 250,
                   },
                 },
               }}
               open={talentsOpen}
               onOpen={() => setTalentsOpen(true)}
               onClose={() => setTalentsOpen(false)}
             >
               {talentOptions.map((option) => (
                 <MenuItem key={option} value={option}>
                   {option}
                 </MenuItem>
               ))}
             </Select>
             <FormHelperText>
               재능을 발휘할 수 있는 장소를 추천해드립니다.
             </FormHelperText>
           </FormControl>
           
           <TextField
             label="추가 재능 (쉼표로 구분)"
             value={customTalents}
             onChange={handleCustomTalentsChange}
             fullWidth
             margin="normal"
             variant="outlined"
             helperText="목록에 없는 재능이 있다면 쉼표(,)로 구분하여 입력해주세요."
           />
           
           <FormControl fullWidth margin="normal" variant="outlined">
             <InputLabel id="regions-label">관심 지역 (한국 기준)</InputLabel>
             <Select
               labelId="regions-label"
               multiple
               value={preferredRegions}
               onChange={handleRegionsChange}
               input={<OutlinedInput label="관심 지역 (한국 기준)" />}
               renderValue={(selected) => (
                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                   {selected.map((value) => (
                     <Chip 
                       key={value} 
                       label={regionOptions.find(region => region.value === value)?.label || value} 
                     />
                   ))}
                 </Box>
               )}
               MenuProps={{
                 PaperProps: {
                   style: {
                     maxHeight: 224,
                     width: 250,
                   },
                 },
               }}
               open={regionsOpen}
               onOpen={() => setRegionsOpen(true)}
               onClose={() => setRegionsOpen(false)}
             >
               {regionOptions.map((option) => (
                 <MenuItem key={option.value} value={option.value}>
                   {option.label}
                 </MenuItem>
               ))}
             </Select>
             <FormHelperText>
               어떤 지역의 여행 정보에 관심이 있으신가요?
             </FormHelperText>
           </FormControl>
         </>
       );
       
     default:
       return 'Unknown step';
   }
 };
 
 return (
   <Container maxWidth="sm" sx={{ py: 6 }}>
     <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
       <Box sx={{ mb: 4, textAlign: 'center' }}>
         <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
           회원가입
         </Typography>
         <Typography variant="body2" color="text.secondary">
           MyTripStyle에 오신 것을 환영합니다!
         </Typography>
       </Box>
       
       {error && (
         <Alert severity="error" sx={{ mb: 3 }}>
           {error}
         </Alert>
       )}
       
       <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
         {steps.map((label) => (
           <Step key={label}>
             <StepLabel>{label}</StepLabel>
           </Step>
         ))}
       </Stepper>
       
       <div>
         {getStepContent(activeStep)}
         
         <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
           <Button
             variant="outlined"
             disabled={activeStep === 0 || loading || isSubmitting}
             onClick={handleBack}
             startIcon={<ChevronLeftIcon />}
             type="button"
           >
             이전
           </Button>
           
           {activeStep === steps.length - 1 ? (
             <Button
               variant="contained"
               disabled={loading || isSubmitting}
               onClick={handleSignUp}
               endIcon={loading ? <CircularProgress size={20} /> : null}
               type="button"
             >
               가입하기
             </Button>
           ) : (
             <Button
               variant="contained"
               disabled={loading || isSubmitting}
               onClick={handleNext}
               endIcon={<ChevronRightIcon />}
               type="button"
             >
               다음
             </Button>
           )}
         </Box>
       </div>
       
       {activeStep === 0 && (
         <>
           <Divider sx={{ my: 3 }}>또는</Divider>
           
           <Button
             fullWidth
             variant="outlined"
             size="large"
             sx={{ py: 1.5 }}
             startIcon={<GoogleIcon />}
             onClick={handleGoogleLogin}
             disabled={loading || isSubmitting}
             type="button"
           >
             Google 계정으로 시작하기
           </Button>
           
           <Grid container justifyContent="center" sx={{ mt: 3 }}>
             <Grid item>
               <Typography variant="body2">
                 이미 계정이 있으신가요?{' '}
                 <Link component={RouterLink} to="/login" underline="hover">
                   로그인
                 </Link>
               </Typography>
             </Grid>
           </Grid>
         </>
       )}
     </Paper>
   </Container>
 );
};

export default Register;
