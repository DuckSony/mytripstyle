// src/components/recommendation/PlaceDetailsSkeleton.js
import React from 'react';
import { 
  Container, Box, Divider, Grid, Paper,
  Skeleton, Card, CardContent
} from '@mui/material';

const PlaceDetailsSkeleton = () => {
  return (
    <Container>
      <Box sx={{ position: 'relative', my: 2 }}>
        {/* 뒤로 가기 버튼 스켈레톤 */}
        <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
        </Box>
        
        {/* 이미지 갤러리 스켈레톤 */}
        <Skeleton 
          variant="rectangular" 
          height={300}
          sx={{ borderRadius: 2, mb: 2 }}
          animation="wave"
        />
        
        {/* 기본 정보 스켈레톤 */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton variant="text" width="70%" height={40} />
            <Skeleton variant="circular" width={40} height={40} />
          </Box>
          
          {/* 평점 스켈레톤 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, mt: 1 }}>
            <Skeleton variant="text" width={120} height={24} />
          </Box>
          
          {/* 태그 스켈레톤 */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" width={80} height={26} sx={{ borderRadius: 4 }} />
            ))}
          </Box>
          
          {/* 설명 스켈레톤 */}
          <Skeleton variant="text" height={20} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" height={20} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" height={20} sx={{ mb: 2 }} />
          
          {/* 주소 스켈레톤 */}
          <Box sx={{ display: 'flex', mb: 1 }}>
            <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
            <Skeleton variant="text" width="80%" height={24} />
          </Box>
          
          {/* 연락처 스켈레톤 */}
          <Box sx={{ display: 'flex', mb: 1 }}>
            <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
            <Skeleton variant="text" width="60%" height={24} />
          </Box>
          
          {/* 웹사이트 스켈레톤 */}
          <Box sx={{ display: 'flex', mb: 2 }}>
            <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
            <Skeleton variant="text" width="70%" height={24} />
          </Box>
          
          {/* 버튼 스켈레톤 */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Skeleton variant="rectangular" width="50%" height={40} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width="50%" height={40} sx={{ borderRadius: 1 }} />
          </Box>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        {/* 추천 이유 탭 스켈레톤 */}
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
          
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Box sx={{ display: 'flex' }}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="rectangular" width={80} height={40} sx={{ mr: 1 }} />
              ))}
            </Box>
          </Box>
          
          {/* 추천 이유 카드 스켈레톤 */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={18} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" height={18} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" height={18} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width="80%" height={18} />
            </CardContent>
          </Card>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        {/* MBTI별 평점 스켈레톤 */}
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
          
          <Paper sx={{ p: 2 }}>
            <Skeleton variant="text" width="90%" height={20} sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Grid item xs={6} sm={4} key={i}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      p: 1,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1
                    }}
                  >
                    <Skeleton variant="text" width={40} height={24} />
                    <Skeleton variant="text" width={80} height={20} />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Box>
        
        {/* 리뷰 섹션 스켈레톤 */}
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={40} sx={{ mb: 2, borderRadius: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <Skeleton variant="text" width="60%" height={24} />
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default PlaceDetailsSkeleton;
