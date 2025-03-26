// src/components/ui/SkeletonPlaceCard.js
import React from 'react';
import { 
  Card, 
  CardContent, 
  CardActionArea, 
  Box, 
  Skeleton 
} from '@mui/material';

/**
 * 로딩 중 표시를 위한 스켈레톤 장소 카드 컴포넌트
 * 데이터 로딩 중에 자리 표시자로 사용
 */

const SkeletonPlaceCard = () => {
    return (
      <Card sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden'
      }}>
        <CardActionArea sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'stretch' 
        }}>
          {/* 이미지 영역 */}
          <Skeleton 
            variant="rectangular" 
            animation="wave"
            height={180}
            sx={{ bgcolor: 'grey.200' }}
          />

<CardContent sx={{ flex: 1, p: 2 }}>
          {/* 제목 */}
          <Skeleton 
            variant="text" 
            animation="wave" 
            height={32} 
            width="70%" 
            sx={{ mb: 1, bgcolor: 'grey.200' }} 
          />
          
          {/* 위치 */}
          <Skeleton 
            variant="text" 
            animation="wave" 
            height={24} 
            width="50%" 
            sx={{ mb: 1, bgcolor: 'grey.200' }} 
          />
          
          {/* 설명 */}
          <Skeleton 
            variant="text" 
            animation="wave" 
            height={20} 
            sx={{ bgcolor: 'grey.200' }} 
          />
          <Skeleton 
            variant="text" 
            animation="wave" 
            height={20} 
            sx={{ bgcolor: 'grey.200' }} 
          />

          {/* 태그 */}
          <Box sx={{ display: 'flex', mt: 2, gap: 1 }}>
            <Skeleton variant="rounded" animation="wave" width={60} height={24} sx={{ bgcolor: 'grey.200', borderRadius: 1 }} />
            <Skeleton variant="rounded" animation="wave" width={70} height={24} sx={{ bgcolor: 'grey.200', borderRadius: 1 }} />
            <Skeleton variant="rounded" animation="wave" width={65} height={24} sx={{ bgcolor: 'grey.200', borderRadius: 1 }} />
          </Box>
          
          {/* 평점 영역 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Skeleton variant="rounded" animation="wave" width={80} height={20} sx={{ bgcolor: 'grey.200' }} />
            <Skeleton variant="circular" animation="wave" width={36} height={36} sx={{ bgcolor: 'grey.200' }} />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default SkeletonPlaceCard;
