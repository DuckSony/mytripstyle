// src/components/review/ReviewSummary.js
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Rating, 
  LinearProgress, 
  Divider, 
  Chip,
  Grid,
  Skeleton,
  useTheme
} from '@mui/material';
import { fetchReviewStats } from '../../services/reviewService';
import { useUser } from '../../contexts/UserContext';

// MBTI 유형별 색상 매핑
const MBTI_COLORS = {
  'INFP': '#4FC1E9', // 하늘색
  'ENFP': '#FFCE54', // 노란색
  'INFJ': '#AC92EB', // 보라색
  'ENFJ': '#A0D568', // 녹색
  'INTP': '#EC87C0', // 핑크색
  'ENTP': '#FC6E51', // 주황색
  'INTJ': '#5D9CEC', // 파란색
  'ENTJ': '#ED5565', // 빨간색
  'ISFP': '#48CFAD', // 민트색
  'ESFP': '#FFCE54', // 노란색
  'ISFJ': '#8CC152', // 녹색
  'ESFJ': '#FC6E51', // 주황색
  'ISTP': '#4FC1E9', // 하늘색
  'ESTP': '#ED5565', // 빨간색
  'ISTJ': '#5D9CEC', // 파란색
  'ESTJ': '#AC92EB'  // 보라색
};

// MBTI 소분류 그룹
const MBTI_GROUPS = {
  'analysts': ['INTJ', 'INTP', 'ENTJ', 'ENTP'],
  'diplomats': ['INFJ', 'INFP', 'ENFJ', 'ENFP'],
  'sentinels': ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'],
  'explorers': ['ISTP', 'ISFP', 'ESTP', 'ESFP']
};

// MBTI 분류 한글명
const MBTI_GROUP_NAMES = {
  'analysts': '분석가형',
  'diplomats': '외교관형',
  'sentinels': '관리자형',
  'explorers': '탐험가형'
};

const ReviewSummary = ({ placeId }) => {
  const theme = useTheme();
  const { userProfile } = useUser();
  
  // 상태 관리
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 통계 데이터 로드
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await fetchReviewStats(placeId);
        
        if (result.success) {
          setStats(result.data);
        } else {
          setError(result.error || '리뷰 통계를 불러오는 중 오류가 발생했습니다.');
        }
      } catch (err) {
        console.error('Error loading review stats:', err);
        setError('리뷰 통계를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    
    loadStats();
  }, [placeId]);
  
  // 로딩 상태 UI
  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" width="60%" height={30} />
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Skeleton variant="circular" width={56} height={56} sx={{ mr: 2 }} />
            <Box>
              <Skeleton variant="text" width={120} />
              <Skeleton variant="text" width={80} />
            </Box>
          </Box>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Box>
          <Skeleton variant="text" width="40%" sx={{ mb: 1 }} />
          {[5, 4, 3, 2, 1].map((rating) => (
            <Box key={rating} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Skeleton variant="text" width={30} sx={{ mr: 1 }} />
              <Skeleton variant="rectangular" height={10} width="70%" sx={{ mr: 1 }} />
              <Skeleton variant="text" width={30} />
            </Box>
          ))}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Skeleton variant="text" width="50%" sx={{ mb: 1 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="rectangular" width={70} height={30} />
          ))}
        </Box>
      </Paper>
    );
  }
  
  // 에러 상태 UI
  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
        <Typography variant="subtitle1" gutterBottom>
          리뷰 통계를 불러올 수 없습니다
        </Typography>
        <Typography variant="body2">
          {error}
        </Typography>
      </Paper>
    );
  }
  
  // 데이터가 없는 경우
  if (!stats || stats.totalCount === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" align="center">
          아직 리뷰가 없습니다
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary">
          첫 리뷰를 작성해보세요!
        </Typography>
      </Paper>
    );
  }
  
  // MBTI 순위 (가장 많은 순으로 정렬)
  const mbtiRanking = Object.entries(stats.mbtiDistribution || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6); // 상위 6개만 표시
  
  // 내 MBTI 순위 찾기
  const findMyMbtiRank = () => {
    if (!userProfile?.mbti || !stats.mbtiDistribution) return null;
    
    const myMbti = userProfile.mbti;
    
    if (!stats.mbtiDistribution[myMbti]) return null;
    
    // 랭킹 계산
    const sortedDistribution = Object.entries(stats.mbtiDistribution)
      .sort((a, b) => b[1] - a[1]);
    
    const myRank = sortedDistribution.findIndex(([mbti]) => mbti === myMbti) + 1;
    const totalCount = sortedDistribution.length;
    
    return {
      mbti: myMbti,
      count: stats.mbtiDistribution[myMbti],
      rank: myRank,
      totalMbtiTypes: totalCount
    };
  };
  
  const myMbtiRank = findMyMbtiRank();
  
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      {/* 전체 평점 요약 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          평점 및 리뷰
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography 
            variant="h3" 
            component="div"
            sx={{ 
              fontWeight: 'bold',
              mr: 2,
              color: theme.palette.primary.main
            }}
          >
            {stats.averageRating.toFixed(1)}
          </Typography>
          
          <Box>
            <Rating 
              value={stats.averageRating} 
              precision={0.1} 
              readOnly 
              size="large" 
            />
            <Typography variant="body2" color="text.secondary">
              {stats.totalCount}개의 리뷰
            </Typography>
          </Box>
        </Box>
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      {/* 평점 분포 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          평점 분포
        </Typography>
        
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = stats.ratingDistribution[rating] || 0;
          const percentage = stats.totalCount > 0
            ? (count / stats.totalCount) * 100
            : 0;
          
          return (
            <Box 
              key={rating} 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                mb: 1
              }}
            >
              <Box sx={{ minWidth: 30, textAlign: 'right', mr: 1 }}>
                {rating}
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={percentage} 
                sx={{ 
                  flexGrow: 1, 
                  height: 8, 
                  borderRadius: 1,
                  mr: 1,
                  backgroundColor: 'grey.200'
                }} 
                color={rating >= 4 ? "success" : rating >= 3 ? "primary" : "error"}
              />
              <Box sx={{ minWidth: 40 }}>
                {count}명
              </Box>
            </Box>
          );
        })}
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      {/* MBTI 분포 */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          MBTI 유형별 리뷰 분포
        </Typography>
        
        {/* 내 MBTI 순위 (있는 경우) */}
        {myMbtiRank && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mb: 2,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.100'
            }}
          >
            <Chip 
              label={myMbtiRank.mbti}
              sx={{ 
                bgcolor: MBTI_COLORS[myMbtiRank.mbti],
                color: '#fff',
                fontWeight: 'bold',
                mr: 1.5
              }}
            />
            <Typography variant="body2">
              내 MBTI는 이 장소 방문자 중 <strong>{myMbtiRank.rank}위</strong>
              {myMbtiRank.totalMbtiTypes > 0 && ` (${myMbtiRank.totalMbtiTypes}개 유형 중)`} 
              ({myMbtiRank.count}명)
            </Typography>
          </Box>
        )}
        
        <Grid container spacing={1}>
          {mbtiRanking.map(([mbti, count], index) => (
            <Grid item xs={6} sm={4} key={mbti}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  p: 1,
                  borderRadius: 1,
                  border: userProfile?.mbti === mbti ? '2px solid' : '1px solid',
                  borderColor: userProfile?.mbti === mbti ? 'primary.main' : 'divider',
                  bgcolor: userProfile?.mbti === mbti ? 'primary.50' : 'background.paper'
                }}
              >
                <Chip 
                  label={mbti}
                  size="small"
                  sx={{ 
                    bgcolor: MBTI_COLORS[mbti],
                    color: '#fff',
                    fontWeight: 'bold',
                    mr: 1
                  }}
                />
                <Typography variant="body2">
                  {count}명 ({Math.round(count / stats.totalCount * 100)}%)
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        
        {/* MBTI 그룹 정보 */}
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="caption" color="text.secondary" paragraph>
            <strong>MBTI 유형 그룹:</strong>
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(MBTI_GROUP_NAMES).map(([group, name]) => (
              <Grid item key={group} xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  <strong>{name}:</strong> {MBTI_GROUPS[group].join(', ')}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </Paper>
  );
};

export default ReviewSummary;
