// src/components/recommendation/PlaceCardSkeleton.js
import React from 'react';
import { 
  Card, CardContent, Box, 
  Skeleton
} from '@mui/material';

/**
 * 장소 카드 스켈레톤 컴포넌트
 * 장소 카드 데이터가 로딩 중일 때 표시되는 스켈레톤 UI
 */
const PlaceCardSkeleton = () => {
  return (
    <Card sx={{ maxWidth: 345, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 이미지 영역 스켈레톤 */}
      <Skeleton 
        variant="rectangular" 
        height={140} 
        animation="wave"
        sx={{ bgcolor: 'rgba(0, 0, 0, 0.08)' }}
      />
      
      <CardContent sx={{ flexGrow: 1 }}>
        {/* 장소명 스켈레톤 */}
        <Skeleton 
          variant="text" 
          height={32} 
          width="80%" 
          animation="wave"
          sx={{ mb: 1 }}
        />
        
        {/* 평점 스켈레톤 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Skeleton 
            variant="text" 
            height={24} 
            width="60%" 
            animation="wave" 
          />
        </Box>
        
        {/* 거리/지역 스켈레톤 */}
        <Skeleton 
          variant="text" 
          height={24} 
          width="40%" 
          animation="wave"
          sx={{ mb: 1 }}
        />
        
        {/* 추천 이유 스켈레톤 */}
        <Skeleton 
          variant="text" 
          height={24} 
          width="90%" 
          animation="wave"
          sx={{ mb: 1 }}
        />
        
        {/* 태그 스켈레톤 */}
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          <Skeleton variant="rounded" height={24} width={60} animation="wave" />
          <Skeleton variant="rounded" height={24} width={80} animation="wave" />
          <Skeleton variant="rounded" height={24} width={70} animation="wave" />
        </Box>
      </CardContent>
    </Card>
  );
};

export default PlaceCardSkeleton;
