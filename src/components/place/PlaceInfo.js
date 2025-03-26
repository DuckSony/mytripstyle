/**
 * src/components/place/PlaceInfo.js
 * 장소 기본 정보를 표시하는 컴포넌트
 */

import React from 'react';
import { 
  Box, 
  Typography, 
  Chip, 
  Divider, 
  Rating, 
  Card, 
  CardContent,
  Grid,
  Avatar,
  Stack
} from '@mui/material';
import { 
  LocationOn as LocationOnIcon,
  Phone as PhoneIcon,
  Language as LanguageIcon,
  AccessTime as AccessTimeIcon,
  Category as CategoryIcon,
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// 가격 수준에 따른 기호 표시
const getPriceLevel = (level) => {
  if (!level) return '정보 없음';
  
  const levels = {
    1: '₩',    // 저렴함
    2: '₩₩',   // 보통
    3: '₩₩₩',  // 비쌈
    4: '₩₩₩₩', // 매우 비쌈
    5: '₩₩₩₩₩' // 아주 매우 비쌈
  };
  
  return levels[level] || '정보 없음';
};

/**
 * 장소 기본 정보 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {Object} props.place - 장소 데이터
 * @param {string} props.mbtiType - 사용자 MBTI 유형
 */
const PlaceInfo = ({ place, mbtiType }) => {
  if (!place) return null;

  // 연락처 정보 가져오기
  const getContactInfo = () => {
    if (!place.contactInfo) return {};
    return place.contactInfo;
  };
  
  const contactInfo = getContactInfo();
  
  // 영업시간 형식화
  const formatOperatingHours = () => {
    if (!place.operatingHours) return '정보 없음';
    
    // 여기서는 간단히 문자열로 반환하지만, 실제로는 구조화된 형태로 처리 필요
    return place.operatingHours.description || '정보 없음';
  };
  
  return (
    <Card sx={{ mb: 3, overflow: 'visible', boxShadow: 2, borderRadius: 2 }}>
      <CardContent sx={{ p: 3 }}>
        {/* 장소 이름 및 기본 정보 */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={8}>
              <Typography variant="h4" component="h1" gutterBottom fontWeight="500">
                {place.name}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Rating 
                    value={place.averageRating?.overall || 0} 
                    precision={0.1} 
                    readOnly 
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({place.reviewCount || 0}개의 리뷰)
                  </Typography>
                </Box>
                
                {mbtiType && place.mbtiMatchScore && place.mbtiMatchScore[mbtiType] && (
                  <Chip 
                    label={`${mbtiType} 적합도: ${(place.mbtiMatchScore[mbtiType]/10).toFixed(1)}`}
                    color="primary"
                    size="small"
                    variant="outlined"
                  />
                )}
                
                {place.priceLevel && (
                  <Chip
                    icon={<AttachMoneyIcon />}
                    label={getPriceLevel(place.priceLevel)}
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
              
              <Typography variant="body1" sx={{ mt: 2, mb: 2 }}>
                {place.description}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ bgcolor: 'background.default', borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    카테고리
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    <Chip
                      icon={<CategoryIcon fontSize="small" />}
                      label={place.category || '기타'}
                      size="small"
                    />
                    
                    {place.subCategory && (
                      <Chip
                        label={place.subCategory}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    특징
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {place.specialFeatures?.map((feature) => (
                      <Chip key={feature} label={feature} size="small" variant="outlined" />
                    ))}
                    
                    {(!place.specialFeatures || place.specialFeatures.length === 0) && (
                      <Typography variant="body2" color="text.secondary">
                        정보 없음
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* 상세 정보 */}
        <Grid container spacing={2}>
          {/* 주소 및 위치 정보 */}
          <Grid item xs={12} sm={6}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex' }}>
                <Avatar 
                  sx={{ bgcolor: 'primary.light', mr: 2 }}
                  variant="rounded"
                >
                  <LocationOnIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2">위치</Typography>
                  <Typography variant="body2">
                    {place.region} {place.subRegion}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {place.address || '상세 주소 정보 없음'}
                  </Typography>
                </Box>
              </Box>
              
              {contactInfo.phone && (
                <Box sx={{ display: 'flex' }}>
                  <Avatar 
                    sx={{ bgcolor: 'success.light', mr: 2 }}
                    variant="rounded"
                  >
                    <PhoneIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">연락처</Typography>
                    <Typography 
                      variant="body2" 
                      component="a"
                      href={`tel:${contactInfo.phone}`}
                      sx={{ color: 'text.primary', textDecoration: 'none' }}
                    >
                      {contactInfo.phone}
                    </Typography>
                  </Box>
                </Box>
              )}
              
              {contactInfo.website && (
                <Box sx={{ display: 'flex' }}>
                  <Avatar 
                    sx={{ bgcolor: 'info.light', mr: 2 }}
                    variant="rounded"
                  >
                    <LanguageIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">웹사이트</Typography>
                    <Typography 
                      variant="body2" 
                      component="a" 
                      href={contactInfo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main' }}
                    >
                      방문하기
                    </Typography>
                  </Box>
                </Box>
              )}
            </Stack>
          </Grid>
          
          {/* 영업시간 및 기타 정보 */}
          <Grid item xs={12} sm={6}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex' }}>
                <Avatar 
                  sx={{ bgcolor: 'warning.light', mr: 2 }}
                  variant="rounded"
                >
                  <AccessTimeIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2">영업시간</Typography>
                  <Typography variant="body2">
                    {formatOperatingHours()}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex' }}>
                <Avatar 
                  sx={{ bgcolor: 'secondary.light', mr: 2 }}
                  variant="rounded"
                >
                  <InfoIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2">추가 정보</Typography>
                  <Typography variant="body2">
                    평균 방문 시간: {place.averageVisitDuration ? `약 ${place.averageVisitDuration}분` : '정보 없음'}
                  </Typography>
                  {place.bestTimeToVisit && (
                    <Typography variant="body2">
                      추천 방문 시간: {place.bestTimeToVisit.timeOfDay?.join(', ') || '정보 없음'}
                    </Typography>
                  )}
                </Box>
              </Box>
              
              {contactInfo.instagram && (
                <Box sx={{ display: 'flex' }}>
                  <Avatar 
                    sx={{ 
                      background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                      mr: 2
                    }}
                    variant="rounded"
                  >
                    <span style={{ fontWeight: 'bold' }}>in</span>
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">인스타그램</Typography>
                    <Typography 
                      variant="body2" 
                      component="a" 
                      href={`https://instagram.com/${contactInfo.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: '#e1306c' }}
                    >
                      {contactInfo.instagram}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default PlaceInfo;
